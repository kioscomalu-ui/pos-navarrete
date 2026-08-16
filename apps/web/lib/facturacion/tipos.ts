export interface DatosComprobante {
  tipo: 'factura_a' | 'factura_b' | 'factura_c';
  puntoVenta: number;

  fecha: Date;
  neto: number;
  iva: number;
  total: number;

  receptor: {
    nombre?: string;
    docTipo: number;    // 80=CUIT, 96=DNI, 99=consumidor final
    docNro: string;     // "0" para consumidor final sin identificar
    condicionIva: number;
  };

  items: Array<{
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
}

export interface ResultadoCAE {
  ok: boolean;
  cae?: string;
  caeVencimiento?: string;   // YYYY-MM-DD
  numero?: number;
  qrDatos?: string;
  error?: string;
  observaciones?: string;
  /** true si conviene reintentar (red, servicio caído) */
  reintentable?: boolean;
}

export interface ProveedorFacturacion {
  solicitarCAE(datos: DatosComprobante): Promise<ResultadoCAE>;
  ultimoNumero(puntoVenta: number, tipo: string): Promise<number>;
  estado(): Promise<{ disponible: boolean; mensaje?: string }>;
}