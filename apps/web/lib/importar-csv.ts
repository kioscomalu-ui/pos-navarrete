import Papa from 'papaparse';
import { calcularPrecio, calcularMargen } from '@pos/shared/utils/calcular-precio';
import type {
  MargenTipo,
  ReglaRedondeo,
  UnidadMedida,
} from '@pos/shared/types';

// ====================================================================
// Tipos
// ====================================================================

export interface FilaImportada {
  linea: number;
  codigoBarras: string | null;
  nombre: string;
  categoria: string | null;
  unidad: UnidadMedida;
  costo: number;
  margenTipo: MargenTipo;
  margenValor: number;
  stockInicial: number;
  stockMinimo: number;

  // Precio resultante
  precioBase: number;
  redondeoAplicado: number;
  precioFinal: number;
  margenReal: number;
  /** true si el precio vino del archivo y no se calculó desde el costo */
  precioManual: boolean;

  // Estado de la fila
  errores: string[];
  duplicadoEnArchivo: boolean;
  existeEnBase: boolean;
}

export interface ResultadoParseo {
  filas: FilaImportada[];
  totalFilas: number;
  conErrores: number;
  duplicados: number;
  yaExisten: number;
  conPrecioManual: number;
  categoriasNuevas: string[];
}

export interface OpcionesParseo {
  reglaRedondeo: ReglaRedondeo;
  codigosExistentes: Set<string>;
  categoriasExistentes: Set<string>;
  margenMinimo?: number;
}

// ====================================================================
// Utilidades
// ====================================================================

const UNIDADES: UnidadMedida[] = ['unidad', 'kg', 'litro', 'metro'];

/**
 * Convierte a número aceptando los dos formatos que salen de Excel:
 * "1.234,56" (español) y "1234.56" (inglés).
 */
function aNumero(valor: string | undefined): number {
  if (!valor) return NaN;

  const limpio = valor.trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!limpio) return NaN;

  // Si tiene coma y punto, el último separador es el decimal
  if (limpio.includes(',') && limpio.includes('.')) {
    return limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
      ? Number(limpio.replace(/\./g, '').replace(',', '.'))
      : Number(limpio.replace(/,/g, ''));
  }

  // Solo coma: es el separador decimal
  if (limpio.includes(',')) return Number(limpio.replace(',', '.'));

  return Number(limpio);
}

/** Toma el primer valor no vacío entre varios nombres de columna posibles */
function campo(
  raw: Record<string, string>,
  ...nombres: string[]
): string | undefined {
  for (const n of nombres) {
    const v = raw[n];
    if (v != null && v.trim() !== '') return v;
  }
  return undefined;
}

// ====================================================================
// Parser
// ====================================================================

export function parsearCSV(
  texto: string,
  opciones: OpcionesParseo,
): ResultadoParseo {
  const { data } = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: true,
    delimiter: '', // autodetecta , o ;
    transformHeader: (h) =>
      h
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_'),
  });

  const vistosEnArchivo = new Set<string>();
  const categoriasNuevas = new Set<string>();
  const margenMinimo = opciones.margenMinimo ?? 5;

  const filas: FilaImportada[] = data.map((raw, i) => {
    const errores: string[] = [];
    const linea = i + 2; // +1 por el encabezado, +1 porque se cuenta desde 1

    // --- Nombre ---
    const nombre = (campo(raw, 'nombre', 'descripcion', 'articulo') ?? '').trim();
    if (nombre.length < 2) errores.push('Nombre vacío o muy corto');

    // --- Código de barras ---
    const codigoBarras =
      (campo(raw, 'codigo_barras', 'codigo', 'ean', 'barcode') ?? '').trim() ||
      null;

    let duplicadoEnArchivo = false;
    if (codigoBarras) {
      if (vistosEnArchivo.has(codigoBarras)) {
        duplicadoEnArchivo = true;
        errores.push('Código repetido dentro del archivo');
      }
      vistosEnArchivo.add(codigoBarras);
    }

    // --- Unidad ---
    const unidadRaw = (campo(raw, 'unidad', 'medida') ?? 'unidad')
      .trim()
      .toLowerCase();

    const unidad = UNIDADES.includes(unidadRaw as UnidadMedida)
      ? (unidadRaw as UnidadMedida)
      : 'unidad';

    if (unidadRaw && !UNIDADES.includes(unidadRaw as UnidadMedida)) {
      errores.push(`Unidad desconocida: "${unidadRaw}"`);
    }

    // --- Costo ---
    const costo = aNumero(campo(raw, 'costo', 'costo_unitario', 'precio_costo'));
    const costoValido = Number.isFinite(costo) && costo >= 0;
    if (!costoValido) errores.push('Costo inválido');

    // --- Margen ---
    const margenTipoRaw = (campo(raw, 'margen_tipo', 'tipo_margen') ??
      'porcentaje')
      .trim()
      .toLowerCase();

    const margenTipo: MargenTipo =
      margenTipoRaw === 'importe' || margenTipoRaw === 'fijo'
        ? 'importe'
        : 'porcentaje';

    const margenValor = aNumero(campo(raw, 'margen_valor', 'margen', 'ganancia'));

    // --- Stock ---
    const stockInicial = aNumero(campo(raw, 'stock_inicial', 'stock')) || 0;
    const stockMinimo = aNumero(campo(raw, 'stock_minimo', 'minimo')) || 0;

    // --- Categoría ---
    const categoria = (campo(raw, 'categoria', 'rubro') ?? '').trim() || null;
    if (categoria && !opciones.categoriasExistentes.has(categoria.toLowerCase())) {
      categoriasNuevas.add(categoria);
    }

    // ================================================================
    // Precio
    // Si el archivo trae precio de venta, ese manda y el margen se ignora.
    // ================================================================
    const precioCSV = aNumero(
      campo(raw, 'precio_venta', 'precio', 'precio_final', 'venta'),
    );
    const precioManual = Number.isFinite(precioCSV) && precioCSV > 0;

    let precioBase = 0;
    let redondeoAplicado = 0;
    let precioFinal = 0;

    if (precioManual) {
      precioBase = precioCSV;
      precioFinal = precioCSV;
      redondeoAplicado = 0;
    } else if (costoValido && Number.isFinite(margenValor)) {
      const p = calcularPrecio({
        costoUnitario: costo,
        margenTipo,
        margenValor,
        reglaRedondeo: opciones.reglaRedondeo,
      });
      precioBase = p.precioBase;
      redondeoAplicado = p.redondeoAplicado;
      precioFinal = p.precioFinal;
    } else {
      errores.push('Falta el precio de venta o el margen');
    }

    // --- Validación del margen resultante ---
    // Aplica también cuando el precio vino del archivo: fijar el precio
    // a mano es una decisión, no una excusa para vender a pérdida sin verlo.
    const margenReal =
      costoValido && precioFinal > 0
        ? calcularMargen(costo, precioFinal).porcentaje
        : 0;

    if (costoValido && precioFinal > 0) {
      if (precioFinal <= costo) {
        errores.push('El precio no supera al costo');
      } else if (margenReal < margenMinimo) {
        errores.push(`Margen bajo: ${margenReal}%`);
      }
    }

    return {
      linea,
      codigoBarras,
      nombre,
      categoria,
      unidad,
      costo,
      margenTipo,
      margenValor: Number.isFinite(margenValor) ? margenValor : 0,
      stockInicial,
      stockMinimo,
      precioBase,
      redondeoAplicado,
      precioFinal,
      margenReal,
      precioManual,
      errores,
      duplicadoEnArchivo,
      existeEnBase: codigoBarras
        ? opciones.codigosExistentes.has(codigoBarras)
        : false,
    };
  });

  return {
    filas,
    totalFilas: filas.length,
    conErrores: filas.filter((f) => f.errores.length > 0).length,
    duplicados: filas.filter((f) => f.duplicadoEnArchivo).length,
    yaExisten: filas.filter((f) => f.existeEnBase).length,
    conPrecioManual: filas.filter((f) => f.precioManual).length,
    categoriasNuevas: [...categoriasNuevas],
  };
}

// ====================================================================
// Plantilla
// ====================================================================

export const PLANTILLA_CSV = `codigo_barras,nombre,categoria,unidad,costo,margen_tipo,margen_valor,precio_venta,stock_inicial,stock_minimo
7790040000001,Yerba Playadito 1kg,Almacen,unidad,2400,porcentaje,50,,24,6
7790895000123,Aceite girasol 900ml,Almacen,unidad,1900,,,3200,36,12
,Queso cremoso,Fiambreria,kg,7800,porcentaje,41,,8.5,2
7791234567890,Coca Cola 2.25L,Bebidas,unidad,2100,importe,900,,48,12`;