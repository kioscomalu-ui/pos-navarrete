import Dexie, { type Table } from 'dexie';
import type { UnidadMedida, MetodoPago } from '@pos/shared/types';

// ====================================================================
// Catálogo
// ====================================================================

export interface ArticuloLocal {
  id: string;
  codigoBarras: string | null;
  codigoInterno: string | null;
  nombre: string;
  unidad: UnidadMedida;
  costoUnitario: number;
  precioVentaFinal: number;
  activo: boolean;
  /** El artículo especial de "venta libre": código 000000, precio a mano */
  esGenerico: boolean;
}

export interface StockLocal {
  articuloId: string;
  cantidad: number;
}

// ====================================================================
// Ventas
// ====================================================================

export interface ItemVentaLocal {
  articuloId: string;
  nombre: string;
  unidad: UnidadMedida;
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentaje: number;
  subtotal: number;
  costoUnitarioSnapshot: number;
  /** true en las líneas de venta libre: no descuentan stock */
  esGenerico?: boolean;
}

export interface VentaLocal {
  id: string;
  numeroFactura: string;
  fecha: string;              // ISO — IndexedDB no indexa Date de forma confiable
  sucursalId: string;
  vendedorId: string;
  clienteId: string | null;        // solo si es a cuenta corriente
  clienteNombre: string | null;
  items: ItemVentaLocal[];
  subtotal: number;
  descuentoTotal: number;
  total: number;
  recibido: number | null;
  vuelto: number | null;
  metodoPago: MetodoPago;
  remitoNumero: string | null;
  syncedAt: string | null;
}

// ====================================================================
// Cajas
// ====================================================================

export interface CajaLocal {
  id: string;
  vendedorId: string;
  sucursalId: string;
  fecha: string;                 // YYYY-MM-DD
  estado: 'abierta' | 'cerrada';
  efectivoInicial: number;
  efectivoFinal: number | null;
  billeteraFinal: number | null;
  posnetFinal: number | null;
  totalVentas: number | null;
  totalEfectivo: number | null;
  totalBilletera: number | null;
  totalPosnet: number | null;
  diferencia: number | null;
  notas: string | null;
  abiertaEn: string;
  closedAt: string | null;
  syncedAt: string | null;
}

// ====================================================================
// Cobranzas
// ====================================================================

export interface ClienteLocal {
  id: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  zona: string | null;
  saldo: number;
  limiteCredito: number;
  ultimoPago: string | null;
}

export interface ReciboLocal {
  id: string;
  numeroRecibo: string;
  clienteId: string;
  clienteNombre: string;
  cobradorId: string;
  fecha: string;
  monto: number;
  metodo: 'efectivo' | 'billetera' | 'posnet';
  saldoAnterior: number;
  saldoNuevo: number;
  observaciones: string | null;
  syncedAt: string | null;
}

// ====================================================================
// Chat
// ====================================================================

export interface CanalLocal {
  id: string;
  nombre: string;
  tipo: 'general' | 'sucursal' | 'directo';
  soloLectura: boolean;
  ultimoLeidoAt: string | null;
}

export interface MensajeLocal {
  id: string;
  canalId: string;
  autorId: string;
  autorNombre: string;
  sucursalOrigenId: string | null;
  tipo: 'texto' | 'pedido_stock' | 'aviso' | 'sistema';
  contenido: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  estadoLocal: 'pendiente' | 'enviado';
}

// ====================================================================
// Sincronización
// ====================================================================

export interface TareaSync {
  id: string;
  tipo: 'venta' | 'cobranza' | 'mensaje' | 'caja';
  payload: unknown;
  intentos: number;
  proximoIntento: number;     // timestamp
  ultimoError: string | null;
  creadoEn: number;
}

export interface Numerador {
  clave: string;
  valor: number;
}

// ====================================================================
// Base
// ====================================================================

class DBLocal extends Dexie {
  articulos!: Table<ArticuloLocal, string>;
  stock!: Table<StockLocal, string>;
  ventas!: Table<VentaLocal, string>;
  cola!: Table<TareaSync, string>;
  numeradores!: Table<Numerador, string>;
  cajas!: Table<CajaLocal, string>;
  clientes!: Table<ClienteLocal, string>;
  recibos!: Table<ReciboLocal, string>;
  canales!: Table<CanalLocal, string>;
  mensajes!: Table<MensajeLocal, string>;

  constructor() {
    super('pos-navarrete');

    this.version(1).stores({
      articulos: 'id, codigoBarras, codigoInterno, nombre',
      stock: 'articuloId',
      ventas: 'id, fecha, syncedAt, numeroFactura',
      cola: 'id, proximoIntento, tipo',
      numeradores: 'clave',
    });

    this.version(2).stores({
      cajas: 'id, fecha, estado, vendedorId',
    });

    this.version(3).stores({
      clientes: 'id, nombre, zona, saldo',
      recibos: 'id, fecha, clienteId, syncedAt',
    });

    this.version(4).stores({
      canales: 'id, tipo',
      mensajes: 'id, canalId, createdAt, estadoLocal',
    });
  }
}

export const dbLocal = new DBLocal();

// ====================================================================
// Numeración local
// ====================================================================

/**
 * Numerador local. IndexedDB no tiene incremento atómico,
 * así que se usa una transacción.
 */
export async function siguienteNumero(clave: string): Promise<number> {
  return dbLocal.transaction('rw', dbLocal.numeradores, async () => {
    const actual = await dbLocal.numeradores.get(clave);
    const nuevo = (actual?.valor ?? 0) + 1;
    await dbLocal.numeradores.put({ clave, valor: nuevo });
    return nuevo;
  });
}

// ====================================================================
// Mantenimiento
// ====================================================================

/**
 * Borra del dispositivo las ventas viejas que YA subieron al servidor.
 * Se ejecuta al abrir caja. Nunca borra lo pendiente de sincronizar.
 */
export async function purgarLocal(diasRetencion = 45): Promise<number> {
  const corte = new Date();
  corte.setDate(corte.getDate() - diasRetencion);
  const corteISO = corte.toISOString();

  const viejas = await dbLocal.ventas
    .where('fecha')
    .below(corteISO)
    .filter((v) => v.syncedAt !== null)
    .toArray();

  await dbLocal.ventas.bulkDelete(viejas.map((v) => v.id));
  return viejas.length;
}