import Decimal from 'decimal.js';
import {
  dbLocal,
  siguienteNumero,
  type ClienteLocal,
  type ReciboLocal,
} from './db-local';
import { encolar } from './cola-sync';
import { supabase } from './supabase';

/** Descarga la cartera del cobrador. Una sola consulta al arrancar el día. */
export async function descargarCartera(cobradorId: string): Promise<number> {
  const { data, error } = await supabase.rpc('cartera_cobrador', {
    p_cobrador_id: cobradorId,
  });

  if (error) throw error;

  const clientes: ClienteLocal[] = (data ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    direccion: c.direccion,
    zona: c.zona,
    saldo: Number(c.saldo),
    limiteCredito: Number(c.limite_credito),
    ultimoPago: c.ultimo_pago,
  }));

  await dbLocal.transaction('rw', dbLocal.clientes, async () => {
    await dbLocal.clientes.clear();
    await dbLocal.clientes.bulkPut(clientes);
  });

  return clientes.length;
}

export async function cartera(): Promise<ClienteLocal[]> {
  return dbLocal.clientes.orderBy('saldo').reverse().toArray();
}

export async function buscarEnCartera(termino: string): Promise<ClienteLocal[]> {
  const t = termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.length < 2) return [];

  const todos = await dbLocal.clientes.toArray();
  return todos
    .filter((c) =>
      c.nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes(t),
    )
    .slice(0, 15);
}

/**
 * Registra un pago. Instantáneo, sin red.
 * Devuelve el recibo listo para imprimir o compartir.
 */
export async function registrarPago(
  cliente: ClienteLocal,
  cobradorId: string,
  puntoVenta: number,
  monto: number,
  metodo: ReciboLocal['metodo'],
  observaciones?: string,
): Promise<ReciboLocal> {
  if (monto <= 0) throw new Error('El monto tiene que ser mayor a cero');

  const n = await siguienteNumero(`recibo:${puntoVenta}`);
  const numeroRecibo =
    `R${String(puntoVenta).padStart(4, '0')}-${String(n).padStart(8, '0')}`;

  const saldoNuevo = new Decimal(cliente.saldo)
    .minus(monto)
    .toDecimalPlaces(2)
    .toNumber();

  const recibo: ReciboLocal = {
    id: crypto.randomUUID(),
    numeroRecibo,
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    cobradorId,
    fecha: new Date().toISOString(),
    monto,
    metodo,
    saldoAnterior: cliente.saldo,
    saldoNuevo,
    observaciones: observaciones || null,
    syncedAt: null,
  };

  await dbLocal.recibos.put(recibo);
  await dbLocal.clientes.update(cliente.id, { saldo: saldoNuevo });

  await encolar('cobranza', {
    id: recibo.id,
    numeroRecibo: recibo.numeroRecibo,
    clienteId: recibo.clienteId,
    cobradorId: recibo.cobradorId,
    fecha: recibo.fecha,
    monto: recibo.monto,
    metodo: recibo.metodo,
    saldoAnterior: recibo.saldoAnterior,
    saldoNuevo: recibo.saldoNuevo,
    observaciones: recibo.observaciones,
  });

  return recibo;
}

export interface Rendicion {
  cantidad: number;
  total: number;
  efectivo: number;
  billetera: number;
  posnet: number;
  recibos: ReciboLocal[];
}

/** Calcula la rendición del día desde los recibos locales */
export async function rendicionDelDia(cobradorId: string): Promise<Rendicion> {
  const hoy = new Date().toISOString().slice(0, 10);

  const recibos = await dbLocal.recibos
    .where('fecha')
    .between(`${hoy}T00:00:00`, `${hoy}T23:59:59`, true, true)
    .filter((r) => r.cobradorId === cobradorId)
    .toArray();

  const sumar = (m?: ReciboLocal['metodo']) =>
    recibos
      .filter((r) => !m || r.metodo === m)
      .reduce((acc, r) => acc.plus(r.monto), new Decimal(0))
      .toDecimalPlaces(2)
      .toNumber();

  return {
    cantidad: recibos.length,
    total: sumar(),
    efectivo: sumar('efectivo'),
    billetera: sumar('billetera'),
    posnet: sumar('posnet'),
    recibos: recibos.sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
}

/** Texto del recibo para mandar por WhatsApp */
export function reciboComoTexto(recibo: ReciboLocal, empresa: string): string {
  const money = (n: number) =>
    n.toLocaleString('es-AR', { minimumFractionDigits: 2 });

  return [
    `*${empresa.toUpperCase()}*`,
    `Recibo ${recibo.numeroRecibo}`,
    new Date(recibo.fecha).toLocaleString('es-AR'),
    ``,
    `Cliente: ${recibo.clienteNombre}`,
    `*Pago recibido: $${money(recibo.monto)}*`,
    ``,
    `Saldo anterior: $${money(recibo.saldoAnterior)}`,
    `Saldo actual: $${money(recibo.saldoNuevo)}`,
    ``,
    `_Documento no fiscal._`,
    `¡Gracias!`,
  ].join('\n');
}

export function enviarReciboWhatsApp(
  recibo: ReciboLocal,
  empresa: string,
  telefono?: string | null,
) {
  const texto = encodeURIComponent(reciboComoTexto(recibo, empresa));
  const numero = (telefono ?? '').replace(/\D/g, '');
  const prefijo = numero && !numero.startsWith('54') ? `54${numero}` : numero;
  window.open(`https://wa.me/${prefijo}?text=${texto}`, '_blank');
}

/**
 * Trae TODOS los clientes activos, sin filtrar por cobrador — a
 * diferencia de descargarCartera(), que es específica de las rutas
 * de cobranza. Esta es la que necesita la caja para vender a cuenta
 * corriente: cualquier cliente activo, no solo los de una ruta.
 */
export async function sincronizarClientesSucursal(): Promise<number> {
   const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, direccion, zona, saldo, limite_credito')
    .eq('activo', true);
  if (error) throw error;

  const clientes: ClienteLocal[] = (data ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    direccion: c.direccion,
    zona: c.zona,
    saldo: Number(c.saldo),
    limiteCredito: Number(c.limite_credito),
    ultimoPago: null,
  }));

  await dbLocal.transaction('rw', dbLocal.clientes, async () => {
    await dbLocal.clientes.clear();
    await dbLocal.clientes.bulkPut(clientes);
  });

  return clientes.length;
}