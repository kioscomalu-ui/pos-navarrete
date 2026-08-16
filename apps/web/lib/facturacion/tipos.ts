// ====================================================================
// Datos para emitir
// ====================================================================

export interface DatosComprobante {
  tipo: 'factura_a' | 'factura_b' | 'factura_c';
  puntoVenta: number;

  fecha: Date;
  neto: number;
  iva: number;
  total: number;

  receptor: {
    nombre?: string;
    docTipo: number;
    docNro: string;
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
  caeVencimiento?: string;
  numero?: number;
  qrDatos?: string;
  error?: string;
  observaciones?: string;
  /** true si conviene reintentar: red caída, servicio no disponible */
  reintentable?: boolean;
}

export interface ProveedorFacturacion {
  solicitarCAE(datos: DatosComprobante): Promise<ResultadoCAE>;
  ultimoNumero(puntoVenta: number, tipo: string): Promise<number>;
  estado(): Promise<{ disponible: boolean; mensaje?: string }>;
}

// ====================================================================
// Códigos de ARCA
// ====================================================================

/** Condición del receptor frente al IVA. Obligatorio desde la versión 4.5 */
export const CONDICION_IVA_RECEPTOR = {
  RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
  NO_CATEGORIZADO: 7,
} as const;

/** Tipo de documento del receptor */
export const TIPO_DOC = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  CONSUMIDOR_FINAL: 99,
} as const;

/** Códigos de comprobante */
export const COD_COMPROBANTE = {
  factura_a: 1,
  factura_b: 6,
  factura_c: 11,
  nota_credito_a: 3,
  nota_credito_b: 8,
  nota_credito_c: 13,
} as const;

/** Alícuotas de IVA con su código de ARCA */
export const COD_ALICUOTA_IVA: Record<number, number> = {
  0: 3,
  10.5: 4,
  21: 5,
  27: 6,
  5: 8,
  2.5: 9,
};

// ====================================================================
// Reglas
// ====================================================================

/**
 * Qué comprobante corresponde emitir.
 * Monotributo emite siempre C. Responsable inscripto emite A cuando el
 * cliente también es responsable inscripto, y B en los demás casos.
 */
export function tipoQueCorresponde(
  condicionEmisor: string,
  condicionReceptor: number,
): 'factura_a' | 'factura_b' | 'factura_c' {
  if (condicionEmisor !== 'responsable_inscripto') return 'factura_c';

  return condicionReceptor === CONDICION_IVA_RECEPTOR.RESPONSABLE_INSCRIPTO
    ? 'factura_a'
    : 'factura_b';
}

/** Descompone un precio que ya incluye IVA */
export function descomponerIva(
  totalConIva: number,
  alicuota: number,
): { neto: number; iva: number } {
  const neto = Math.round((totalConIva / (1 + alicuota / 100)) * 100) / 100;
  return {
    neto,
    iva: Math.round((totalConIva - neto) * 100) / 100,
  };
}