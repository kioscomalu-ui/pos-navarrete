/**
 * Datos de la empresa.
 * Se usan en el remito, el encabezado de la app y los reportes.
 *
 * Los campos vacíos hay que completarlos antes de imprimir remitos reales.
 */
export const EMPRESA = {
  razonSocial: 'Navarrete Elsa Graciela',
  nombreCorto: 'MALU-DOÑA ELSA',

  // --- Completar con los datos reales ---
  cuit: '27-22816882-9',
  domicilio: 'San Martín 1207/1213',
  localidad: 'Cipolletti, Río Negro',
  condicionIVA: 'Responsable Inscripto',        // 'Monotributo' | 'Responsable Inscripto' | ...
  ingresosBrutos: '',
  inicioActividades: '',
  telefono: '',
  email: 'kioscomalu@gmail.com',
} as const;

/** Identidad de la aplicación */
export const APP = {
  nombre: 'Navarrete · Ventas',
  nombreCorto: 'Navarrete',
  version: '1.0.0',
} as const;

/** Textos del remito */
export const REMITO = {
  titulo: 'REMITO',
  subtitulo: 'documento no fiscal',
  leyendaLegal: 'ESTE COMPROBANTE NO ES VÁLIDO\nCOMO FACTURA',
  politicaCambios: 'Cambios dentro de las 48 hs\npresentando este remito',
  despedida: '¡GRACIAS POR SU COMPRA!',
} as const;

/** Configuración regional para formateo de moneda y fechas */
export const LOCALE = {
  idioma: 'es-AR',
  moneda: 'ARS',
  simboloMoneda: '$',
  zonaHoraria: 'America/Argentina/Buenos_Aires',
} as const;

/** Formatea un número como importe: 3600 → "3.600,00" */
export function formatearImporte(monto: number): string {
  return monto.toLocaleString(LOCALE.idioma, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Con símbolo: 3600 → "$ 3.600,00" */
export function formatearPrecio(monto: number): string {
  return `${LOCALE.simboloMoneda} ${formatearImporte(monto)}`;
}

/** Fecha corta: "12/08/2026 14:32" */
export function formatearFecha(fecha: Date): string {
  return fecha.toLocaleString(LOCALE.idioma, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}