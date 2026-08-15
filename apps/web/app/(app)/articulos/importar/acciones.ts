'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';

// ====================================================================
// Tipos
// ====================================================================

export interface FilaParaGuardar {
  codigoBarras: string | null;
  nombre: string;
  categoria: string | null;
  unidad: string;
  costo: number;
  margenTipo: string;
  margenValor: number;
  precioBase: number;
  redondeoAplicado: number;
  precioFinal: number;
  /** true: el precio vino del archivo y no se recalcula desde el costo */
  precioManual: boolean;
  stockInicial: number;
  stockMinimo: number;
}

export interface ResultadoImportacion {
  ok: boolean;
  creados: number;
  actualizados: number;
  categoriasCreadas: number;
  conStock: number;
  error?: string;
}

/** Filas por operación contra la base */
const LOTE = 300;

// ====================================================================
// Importación
// ====================================================================

export async function importarArticulos(
  filas: FilaParaGuardar[],
  modo: 'crear' | 'actualizar',
): Promise<ResultadoImportacion> {
  const vacio = {
    ok: false,
    creados: 0,
    actualizados: 0,
    categoriasCreadas: 0,
    conStock: 0,
  };

  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) {
    return { ...vacio, error: 'No tenés permisos para importar artículos' };
  }

  if (filas.length === 0) {
    return { ...vacio, error: 'No hay filas para importar' };
  }

  const supabase = await createClient();

  // ------------------------------------------------------------------
  // 1. Categorías: crear las que falten
  // ------------------------------------------------------------------
  const { data: existentes, error: errCat } = await supabase
    .from('categorias_articulos')
    .select('id, nombre');

  if (errCat) {
    return { ...vacio, error: `Error leyendo categorías: ${errCat.message}` };
  }

  const mapaCategorias = new Map(
    (existentes ?? []).map((c) => [c.nombre.toLowerCase(), c.id]),
  );

  const nombresEnArchivo = [
    ...new Set(filas.map((f) => f.categoria).filter((c): c is string => !!c)),
  ];

  const faltantes = nombresEnArchivo.filter(
    (n) => !mapaCategorias.has(n.toLowerCase()),
  );

  let categoriasCreadas = 0;

  if (faltantes.length > 0) {
    const { data: nuevas, error } = await supabase
      .from('categorias_articulos')
      .insert(faltantes.map((nombre) => ({ nombre })))
      .select('id, nombre');

    if (error) {
      return { ...vacio, error: `Error creando categorías: ${error.message}` };
    }

    for (const c of nuevas ?? []) {
      mapaCategorias.set(c.nombre.toLowerCase(), c.id);
    }
    categoriasCreadas = nuevas?.length ?? 0;
  }

  // ------------------------------------------------------------------
  // 2. Artículos, por lotes
  // ------------------------------------------------------------------
  let creados = 0;
  let actualizados = 0;

  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE).map((f) => ({
      codigo_barras: f.codigoBarras,
      nombre: f.nombre,
      categoria_id: f.categoria
        ? (mapaCategorias.get(f.categoria.toLowerCase()) ?? null)
        : null,
      unidad: f.unidad,
      costo_unitario: f.costo,
      margen_tipo: f.margenTipo,
      margen_valor: f.margenValor,
      precio_venta_base: f.precioBase,
      redondeo_aplicado: f.redondeoAplicado,
      precio_venta_final: f.precioFinal,
      precio_manual: f.precioManual,
      stock_minimo: f.stockMinimo,
      activo: true,
    }));

    // Con código de barras se pueden reconocer los repetidos.
    // Sin él, siempre entran como nuevos.
    const conCodigo = lote.filter((a) => a.codigo_barras);
    const sinCodigo = lote.filter((a) => !a.codigo_barras);

    if (conCodigo.length > 0) {
      // En los dos modos se usa upsert sobre codigo_barras.
      // La diferencia es qué pasa con los que ya existen:
      // 'actualizar' los pisa, 'crear' los saltea sin tirar error.
      const { data, error } = await supabase
        .from('articulos')
        .upsert(conCodigo, {
          onConflict: 'codigo_barras',
          ignoreDuplicates: modo === 'crear',
        })
        .select('id');

      if (error) {
        return {
          ...vacio,
          creados,
          actualizados,
          categoriasCreadas,
          error: `Fila ${i + 1} en adelante: ${error.message}`,
        };
      }

      if (modo === 'actualizar') actualizados += data?.length ?? 0;
      else creados += data?.length ?? 0;
    }

    if (sinCodigo.length > 0) {
      const { data, error } = await supabase
        .from('articulos')
        .insert(sinCodigo)
        .select('id');

      if (error) {
        return {
          ...vacio,
          creados,
          actualizados,
          categoriasCreadas,
          error: `Fila ${i + 1} en adelante: ${error.message}`,
        };
      }
      creados += data?.length ?? 0;
    }
  }

  // ------------------------------------------------------------------
  // 3. Stock inicial en la sucursal del usuario
  //    Solo para los que tienen código: sin él no hay forma confiable
  //    de identificar cuál de los recién creados es cuál.
  // ------------------------------------------------------------------
  let conStock = 0;
  const filasConStock = filas.filter(
    (f) => f.stockInicial > 0 && f.codigoBarras,
  );

  if (filasConStock.length > 0) {
    const codigos = filasConStock.map((f) => f.codigoBarras!);
    const mapaIds = new Map<string, string>();

    // También por lotes: un IN con miles de valores falla
    for (let i = 0; i < codigos.length; i += LOTE) {
      const { data } = await supabase
        .from('articulos')
        .select('id, codigo_barras')
        .in('codigo_barras', codigos.slice(i, i + LOTE));

      for (const a of data ?? []) {
        if (a.codigo_barras) mapaIds.set(a.codigo_barras, a.id);
      }
    }

    const filasStock = filasConStock
      .map((f) => ({
        articulo_id: mapaIds.get(f.codigoBarras!),
        sucursal_id: sesion.sucursalId,
        cantidad_actual: f.stockInicial,
        ultimo_conteo: new Date().toISOString(),
      }))
      .filter((s): s is typeof s & { articulo_id: string } => !!s.articulo_id);

    for (let i = 0; i < filasStock.length; i += LOTE) {
      const { error } = await supabase
        .from('stock_sucursal')
        .upsert(filasStock.slice(i, i + LOTE), {
          onConflict: 'articulo_id,sucursal_id',
        });

      if (error) {
        return {
          ok: false,
          creados,
          actualizados,
          categoriasCreadas,
          conStock,
          error: `Los artículos se cargaron, pero falló el stock: ${error.message}`,
        };
      }
      conStock += Math.min(LOTE, filasStock.length - i);
    }
  }

  revalidatePath('/articulos');
  revalidatePath('/reportes/faltantes');

  return {
    ok: true,
    creados,
    actualizados,
    categoriasCreadas,
    conStock,
  };
}