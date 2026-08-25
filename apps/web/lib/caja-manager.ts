import { dbLocal, type CajaLocal } from './db-local';
import { encolar } from './cola-sync';
import { supabase } from './supabase';

export interface TotalesDia {
  cantidadVentas: number;
  total: number;
  efectivo: number;
  efectivoEsperado: number;
  billetera: number;
  posnet: number;
  ctaCte: number;
  egresos: number;
  ingresos: number;
}

export interface DeclaracionCierre {
  efectivoFinal: number;
  billeteraFinal: number;
  posnetFinal: number;
  notas: string;
}

export async function abrirCaja(
  vendedorId: string,
  sucursalId: string,
  efectivoInicial: number,
): Promise<CajaLocal> {
  const fecha = new Date().toISOString().slice(0, 10);

  const existente = await dbLocal.cajas
    .where('[vendedorId+fecha]')
    .equals([vendedorId, fecha])
    .first();

  if (existente && existente.estado === 'abierta') return existente;

  const caja: CajaLocal = {
    id: crypto.randomUUID(),
    vendedorId,
    sucursalId,
    fecha,
    estado: 'abierta',
    efectivoInicial,
    efectivoFinal: null,
    billeteraFinal: null,
    posnetFinal: null,
    totalVentas: null,
    totalEfectivo: null,
    totalBilletera: null,
    totalPosnet: null,
    diferencia: null,
    notas: null,
    abiertaEn: new Date().toISOString(),
    closedAt: null,
    syncedAt: null,
  };

  await dbLocal.cajas.put(caja);
  await encolar('caja', caja);

  return caja;
}

export async function cajaAbierta(vendedorId: string): Promise<CajaLocal | null> {
  const abiertas = await dbLocal.cajas
    .where('vendedorId')
    .equals(vendedorId)
    .filter((c) => c.estado === 'abierta')
    .toArray();

  if (abiertas.length === 0) return null;

  return abiertas.sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
}

export async function pagarProveedor(
  cajaId: string,
  monto: number,
  proveedorId: string,
  motivo?: string,
): Promise<void> {
  const { error } = await supabase.rpc('registrar_pago_proveedor', {
    p_caja_id: cajaId,
    p_monto: monto,
    p_proveedor_id: proveedorId,
    p_motivo: motivo || null,
  });
  if (error) throw error;
}

export async function transferirACaja(
  cajaOrigenId: string,
  cajaDestinoId: string,
  monto: number,
  motivo?: string,
): Promise<void> {
  const { error } = await supabase.rpc('registrar_transferencia_caja', {
    p_caja_origen_id: cajaOrigenId,
    p_caja_destino_id: cajaDestinoId,
    p_monto: monto,
    p_motivo: motivo || null,
  });
  if (error) throw error;
}

export interface CajaAbierta {
  id: string;
  vendedor: string;
  sucursal: string;
  sucursalId: string;
}

export async function cajasAbiertas(): Promise<CajaAbierta[]> {
  const { data, error } = await supabase.rpc('cajas_abiertas');
  if (error) throw error;

  return (data ?? []).map((c: any) => ({
    id: c.id,
    vendedor: c.vendedor,
    sucursal: c.sucursal,
    sucursalId: c.sucursal_id,
  }));
}

async function movimientosDeCaja(
  cajaId: string,
): Promise<{ tipo: string; monto: number }[]> {
  const { data } = await supabase
    .from('movimientos_caja')
    .select('tipo, monto')
    .eq('caja_id', cajaId);

  return data ?? [];
}

interface TotalesVentas {
  cantidadVentas: number;
  total: number;
  efectivo: number;
  billetera: number;
  posnet: number;
  ctaCte: number;
}

async function totalesVentasDelServidor(
  vendedorId: string,
  fecha: string,
): Promise<TotalesVentas | null> {
  const { data, error } = await supabase.rpc('totales_caja_dia', {
    p_vendedor_id: vendedorId,
    p_fecha: fecha,
  });

  if (error || !data || data.length === 0) return null;

  const r = data[0];
  return {
    cantidadVentas: Number(r.cantidad_ventas),
    total: Number(r.total_ventas),
    efectivo: Number(r.total_efectivo),
    posnet: Number(r.total_posnet),
    billetera: Number(r.total_billetera),
    ctaCte: Number(r.total_cta_cte),
  };
}

async function totalesVentasLocal(caja: CajaLocal): Promise<TotalesVentas> {
  const ventas = await dbLocal.ventas
    .where('fecha')
    .between(`${caja.fecha}T00:00:00`, `${caja.fecha}T23:59:59`)
    .filter((v) => v.vendedorId === caja.vendedorId)
    .toArray();

  let total = 0;
  let efectivo = 0;
  let billetera = 0;
  let posnet = 0;
  let ctaCte = 0;

  for (const v of ventas) {
    total += v.total;
    for (const p of v.pagos ?? []) {
      if (p.metodo === 'efectivo') efectivo += p.monto;
      if (p.metodo === 'billetera') billetera += p.monto;
      if (p.metodo === 'posnet') posnet += p.monto;
      if (p.metodo === 'cuenta_corriente') ctaCte += p.monto;
    }
  }

  return { cantidadVentas: ventas.length, total, efectivo, posnet, billetera, ctaCte };
}

/**
 * El servidor es la fuente de verdad: tiene las ventas de ese
 * vendedor y esa fecha, sin importar en qué dispositivo se hicieron
 * ni si el que está cerrando ahora conserva esa historia en su
 * IndexedDB. Local queda solo como respaldo si no hay conexión.
 */
export async function totalesDelDia(caja: CajaLocal): Promise<TotalesDia> {
  const delServidor = await totalesVentasDelServidor(caja.vendedorId, caja.fecha);
  const ventas = delServidor ?? (await totalesVentasLocal(caja));

  let egresos = 0;
  let ingresos = 0;

  if (caja.id) {
    try {
      const movimientos = await movimientosDeCaja(caja.id);
      for (const m of movimientos) {
        if (m.tipo === 'pago_proveedor' || m.tipo === 'transferencia_salida') {
          egresos += Number(m.monto);
        }
        if (m.tipo === 'transferencia_entrada') {
          ingresos += Number(m.monto);
        }
      }
    } catch {
      // Sin conexión no se pueden traer los movimientos del servidor.
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return {
    cantidadVentas: ventas.cantidadVentas,
    total: r2(ventas.total),
    efectivo: r2(ventas.efectivo),
    efectivoEsperado: r2(caja.efectivoInicial + ventas.efectivo + ingresos - egresos),
    billetera: r2(ventas.billetera),
    posnet: r2(ventas.posnet),
    ctaCte: r2(ventas.ctaCte),
    egresos: r2(egresos),
    ingresos: r2(ingresos),
  };
}

export async function cerrarCaja(
  caja: CajaLocal,
  datos: DeclaracionCierre,
): Promise<CajaLocal> {
  const totales = await totalesDelDia(caja);

  const diferencia =
    Math.round((datos.efectivoFinal - totales.efectivoEsperado) * 100) / 100;

  const actualizada: CajaLocal = {
    ...caja,
    estado: 'cerrada',
    efectivoFinal: datos.efectivoFinal,
    billeteraFinal: datos.billeteraFinal,
    posnetFinal: datos.posnetFinal,
    totalVentas: totales.total,
    totalEfectivo: totales.efectivo,
    totalBilletera: totales.billetera,
    totalPosnet: totales.posnet,
    diferencia,
    notas: datos.notas || null,
    closedAt: new Date().toISOString(),
  };

  await dbLocal.cajas.put(actualizada);
  await encolar('caja', actualizada);

  return actualizada;
}