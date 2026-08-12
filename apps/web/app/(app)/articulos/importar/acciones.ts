'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';

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
  stockInicial: number;
  stockMinimo: number;
}

export interface ResultadoImportacion {
  ok: boolean;
  creados: number;
  actualizados: number;
  categoriasCreadas: number;
  error?: string;
}

const LOTE = 300;

export async function importarArticulos(
  filas: FilaParaGuardar[],
  modo: 'crear' | 'actualizar',
): Promise<ResultadoImportacion> {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) {
    return { ok: false, creados: 0, actualizados: 0, categoriasCreadas: 0,
             error: 'No tenés permisos para importar artículos' };
  }

  const supabase = await createClient();

  // --- 1. Categorías ---
  const nombresCategorias = [...new Set(
    filas.map((f) => f.categoria).filter((c): c is string => !!c),
  )];

  const { data: existentes } = await supabase
    .from('categorias_articulos')
    .select('id, nombre');

  const mapaCategorias = new Map(
    (existentes ?? []).map((c) => [c.nombre.toLowerCase(), c.id]),
  );

  const faltantes = nombresCategorias.filter(
    (n) => !mapaCategorias.has(n.toLowerCase()),
  );

  let categoriasCreadas = 0;
  if (faltantes.length > 0) {
    const { data: nuevas, error } = await supabase
      .from('categorias_articulos')
      .insert(faltantes.map((nombre) => ({ nombre })))
      .select('id, nombre');

    if (error) {
      return { ok: false, creados: 0, actualizados: 0, categoriasCreadas: 0,
               error: `Error creando categorías: ${error.message}` };
    }

    for (const c of nuevas ?? []) mapaCategorias.set(c.nombre.toLowerCase(), c.id);
    categoriasCreadas = nuevas?.length ?? 0;
  }

  // --- 2. Artículos, por lotes ---
  let creados = 0;
  let actualizados = 0;

  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE).map((f) => ({
      codigo_barras: f.codigoBarras,
      nombre: f.nombre,
      categoria_id: f.categoria
        ? mapaCategorias.get(f.categoria.toLowerCase()) ?? null
        : null,
      unidad: f.unidad,
      costo_unitario: f.costo,
      margen_tipo: f.margenTipo,
      margen_valor: f.margenValor,
      precio_venta_base: f.precioBase,
      redondeo_aplicado: f.redondeoAplicado,
      precio_venta_final: f.precioFinal,
      stock_minimo: f.stockMinimo,
      activo: true,
    }));

    // Los que tienen código de barras se pueden actualizar por conflicto;
    // los que no, siempre se insertan como nuevos.
    const conCodigo = lote.filter((a) => a.codigo_barras);
    const sinCodigo = lote.filter((a) => !a.codigo_barras);

    if (conCodigo.length > 0) {
      const { data, error } =
        modo === 'actualizar'
          ? await supabase
              .from('articulos')
              .upsert(conCodigo, { onConflict: 'codigo_barras' })
              .select('id')
          : await supabase.from('articulos').insert(conCodigo).select('id');

      if (error) {
        return { ok: false, creados, actualizados, categoriasCreadas,
                 error: `Fila ${i + 1}: ${error.message}` };
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
        return { ok: false, creados, actualizados, categoriasCreadas,
                 error: `Fila ${i + 1}: ${error.message}` };
      }
      creados += data?.length ?? 0;
    }
  }

  // --- 3. Stock inicial en la sucursal del usuario ---
  const conStock = filas.filter((f) => f.stockInicial > 0 && f.codigoBarras);

  if (conStock.length > 0) {
    const { data: articulos } = await supabase
      .from('articulos')
      .select('id, codigo_barras')
      .in('codigo_barras', conStock.map((f) => f.codigoBarras!));

    const mapaIds = new Map(
      (articulos ?? []).map((a) => [a.codigo_barras!, a.id]),
    );

    const filasStock = conStock
      .map((f) => ({
        articulo_id: mapaIds.get(f.codigoBarras!),
        sucursal_id: sesion.sucursalId,
        cantidad_actual: f.stockInicial,
      }))
      .filter((s) => s.articulo_id);

    for (let i = 0; i < filasStock.length; i += LOTE) {
      await supabase
        .from('stock_sucursal')
        .upsert(filasStock.slice(i, i + LOTE), {
          onConflict: 'articulo_id,sucursal_id',
        });
    }
  }

  revalidatePath('/articulos');
  return { ok: true, creados, actualizados, categoriasCreadas };
}