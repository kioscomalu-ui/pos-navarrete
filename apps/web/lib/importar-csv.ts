import Papa from 'papaparse';
import { calcularPrecio, calcularMargen } from '@pos/shared/utils/calcular-precio';
import type { MargenTipo, ReglaRedondeo, UnidadMedida } from '@pos/shared/types';

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

  // Calculados
  precioBase: number;
  redondeoAplicado: number;
  precioFinal: number;
  margenReal: number;

  // Estado
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
  categoriasNuevas: string[];
}

const UNIDADES: UnidadMedida[] = ['unidad', 'kg', 'litro', 'metro'];

/** Convierte "1.234,56" o "1234.56" a número */
function aNumero(valor: string): number {
  if (!valor) return NaN;
  const limpio = valor.trim().replace(/\s/g, '');

  // Si tiene coma y punto, el último separador es el decimal
  if (limpio.includes(',') && limpio.includes('.')) {
    return limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
      ? Number(limpio.replace(/\./g, '').replace(',', '.'))
      : Number(limpio.replace(/,/g, ''));
  }
  // Solo coma: es el decimal
  if (limpio.includes(',')) return Number(limpio.replace(',', '.'));
  return Number(limpio);
}

export function parsearCSV(
  texto: string,
  opciones: {
    reglaRedondeo: ReglaRedondeo;
    codigosExistentes: Set<string>;
    categoriasExistentes: Set<string>;
    margenMinimo?: number;
  },
): ResultadoParseo {
  const { data } = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: true,
    delimiter: '',           // autodetecta , o ;
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  const vistosEnArchivo = new Set<string>();
  const categoriasNuevas = new Set<string>();
  const margenMinimo = opciones.margenMinimo ?? 5;

  const filas: FilaImportada[] = data.map((raw, i) => {
    const errores: string[] = [];
    const linea = i + 2;   // +1 por el encabezado, +1 porque las líneas empiezan en 1

    const nombre = (raw.nombre ?? '').trim();
    if (nombre.length < 2) errores.push('Nombre vacío o muy corto');

    const codigoBarras = (raw.codigo_barras ?? '').trim() || null;

    let duplicadoEnArchivo = false;
    if (codigoBarras) {
      if (vistosEnArchivo.has(codigoBarras)) {
        duplicadoEnArchivo = true;
        errores.push('Código repetido dentro del archivo');
      }
      vistosEnArchivo.add(codigoBarras);
    }

    const unidadRaw = (raw.unidad ?? 'unidad').trim().toLowerCase();
    const unidad = UNIDADES.includes(unidadRaw as UnidadMedida)
      ? (unidadRaw as UnidadMedida)
      : 'unidad';
    if (!UNIDADES.includes(unidadRaw as UnidadMedida) && unidadRaw) {
      errores.push(`Unidad desconocida: "${unidadRaw}"`);
    }

    const costo = aNumero(raw.costo ?? '');
    if (!Number.isFinite(costo) || costo < 0) errores.push('Costo inválido');

    const margenTipoRaw = (raw.margen_tipo ?? 'porcentaje').trim().toLowerCase();
    const margenTipo: MargenTipo =
      margenTipoRaw === 'importe' ? 'importe' : 'porcentaje';

    const margenValor = aNumero(raw.margen_valor ?? '');
    if (!Number.isFinite(margenValor)) errores.push('Margen inválido');

    const stockInicial = aNumero(raw.stock_inicial ?? '0') || 0;
    const stockMinimo = aNumero(raw.stock_minimo ?? '0') || 0;

    const categoria = (raw.categoria ?? '').trim() || null;
    if (categoria && !opciones.categoriasExistentes.has(categoria.toLowerCase())) {
      categoriasNuevas.add(categoria);
    }

    // Cálculo de precio
    const valido = Number.isFinite(costo) && Number.isFinite(margenValor);
    const precio = valido
      ? calcularPrecio({
          costoUnitario: costo,
          margenTipo,
          margenValor,
          reglaRedondeo: opciones.reglaRedondeo,
        })
      : { precioBase: 0, redondeoAplicado: 0, precioFinal: 0 };

    const margenReal = valido ? calcularMargen(costo, precio.precioFinal).porcentaje : 0;

    if (valido && precio.precioFinal <= costo) {
      errores.push('El precio final no supera al costo');
    } else if (valido && margenReal < margenMinimo) {
      errores.push(`Margen bajo: ${margenReal}%`);
    }

    return {
      linea,
      codigoBarras,
      nombre,
      categoria,
      unidad,
      costo,
      margenTipo,
      margenValor,
      stockInicial,
      stockMinimo,
      ...precio,
      margenReal,
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
    categoriasNuevas: [...categoriasNuevas],
  };
}