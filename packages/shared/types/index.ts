// ---- Enums (deben coincidir con los del schema SQL) ----
export type RolUsuario    = 'admin' | 'gerente' | 'vendedor' | 'cobrador' | 'supervisor';
export type EstadoVenta   = 'pendiente' | 'completada' | 'anulada';
export type MetodoPago    = 'efectivo' | 'billetera' | 'posnet' | 'mixto' | 'cuenta_corriente';
export type EstadoCaja    = 'abierta' | 'cerrada';
export type UnidadMedida  = 'unidad' | 'kg' | 'litro' | 'metro';
export type MargenTipo    = 'porcentaje' | 'importe';
export type ReglaRedondeo = 'sin_redondeo' | 'al_peso' | 'al_cincuenta' | 'a_la_decena';
export type TipoCanal     = 'general' | 'sucursal' | 'directo';
export type TipoMensaje   = 'texto' | 'pedido_stock' | 'aviso' | 'sistema';

// ---- Núcleo ----
export interface Sucursal {
  id: string;
  nombre: string;
  codigo: string;
  puntoVenta: number;
  ciudad?: string;
  reglaRedondeo: ReglaRedondeo;
  margenDefault: number;
  diasRetencionLocal: number;
  activa: boolean;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido?: string;
  rol: RolUsuario;
  sucursalId: string;
  activo: boolean;
}

export interface Articulo {
  id: string;
  codigoBarras?: string;
  codigoInterno?: string;
  nombre: string;
  categoriaId?: string;
  unidad: UnidadMedida;

  costoUnitario: number;
  proveedorPrincipalId?: string;
  margenTipo: MargenTipo;
  margenValor: number;
  precioVentaBase: number;
  redondeoAplicado: number;
  precioVentaFinal: number;

  stockMinimo: number;
  stockMaximo?: number;
  activo: boolean;
}

// ---- Ventas ----
export interface ItemVenta {
  articuloId: string;
  nombre: string;
  unidad: UnidadMedida;
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentaje: number;
  subtotal: number;
  costoUnitarioSnapshot: number;
  requiereCantidad: boolean;   // artículos por peso, hasta que se pesen
}

export interface Venta {
  id: string;
  numeroFactura: string;
  fecha: Date;
  sucursalId: string;
  vendedorId: string;
  clienteId?: string;
  clienteNombre?: string;

  items: ItemVenta[];
  subtotal: number;
  impuestos: number;
  descuentoTotal: number;
  total: number;
  recibido?: number;
  vuelto?: number;

  estado: EstadoVenta;
  metodoPago: MetodoPago;

  remitoNumero?: string;
  syncedAt: Date | null;
  estadoLocal?: 'pendiente' | 'enviado' | 'error';
}

// ---- Cajas y cobranzas ----
export interface CajaVendedor {
  id: string;
  vendedorId: string;
  sucursalId: string;
  fecha: Date;
  estado: EstadoCaja;
  efectivoInicial: number;
  efectivoFinal?: number;
  billeteraFinal?: number;
  posnetFinal?: number;
  totalVentas?: number;
  diferencia?: number;
  notas?: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
  zona?: string;
  limiteCredito: number;
  saldo: number;
  cobradorId?: string;
  activo: boolean;
}

export interface Recibo {
  id: string;
  numeroRecibo: string;
  clienteId: string;
  cobradorId: string;
  fecha: Date;
  monto: number;
  metodo: MetodoPago;
  saldoAnterior: number;
  saldoNuevo: number;
  syncedAt: Date | null;
}

// ---- Chat ----
export interface Canal {
  id: string;
  nombre: string;
  tipo: TipoCanal;
  sucursalId?: string;
  soloLectura: boolean;
}

export interface Mensaje {
  id: string;
  canalId: string;
  autorId: string;
  autorNombre: string;
  sucursalOrigenId?: string;
  tipo: TipoMensaje;
  contenido: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  estadoLocal?: 'pendiente' | 'enviado' | 'error';
}

// ---- Sincronización ----
export interface EstadoSync {
  online: boolean;
  sincronizando: boolean;
  ultimaSync: Date | null;
  pendientes: number;
}