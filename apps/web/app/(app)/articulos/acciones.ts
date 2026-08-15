'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { calcularPrecio, validarPrecio } from '@pos/shared/utils/calcular-precio';

// ====================================================================
// Validación
// ====================================================================

/**
 * Los checkbox de HTML no mandan nada cuando están destildados, y "on"
 * cuando están tildados. Para que el valor sea siempre explícito, el
 * formulario usa un campo oculto con "true" o "false" y acá se traduce.
 */
const booleanoDeFormulario = z.preprocess(
  (v) => v === 'true' || v === 'on' || v === true,
  z.boolean(),
);

const esquema = z.object({
  codigoBarras: z.string().trim().optional(),
  codigoInterno: z.string().trim().optional(),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  descripcion: z.string().trim().optional(),
  categoriaId: z.string().uuid().optional().or(z.literal('')),
  unidad: z.enum(['unidad', 'kg', 'litro', 'metro']),

  costoUnitario: z.coerce.number().min(0, 'El costo no puede ser negativo'),
  margenTipo: z.enum(['porcentaje', 'importe']),
  margenValor: z.coerce.number(),
  reglaRedondeo: z.enum([
    'sin_redondeo',
    'al_peso',
    'al_cincuenta',
    'a_la_decena',
  ]),

  // Precio fijado a mano: si está activo, manda sobre el cálculo
  precioManual: booleanoDeFormulario.optional(),
  precioFijo: z.coerce.number().min(0).optional(),

  stockMinimo: z.coerce.number().min(0),
  stockMaximo: z.coerce.number().min(0).optional(),
  proveedorId: z.string().uuid().optional().or(z.literal('')),
});

export type EstadoForm = { error?: string; campo?: string };

// ====================================================================
// Crear y editar
// ====================================================================

export async function guardarArticulo(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) {
    return { error: 'No tenés permisos para editar el catálogo' };
  }

  const parsed = esquema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const primero = parsed.error.issues[0];
    return { error: primero.message, campo: String(primero.path[0]) };
  }

  const d = parsed.data;

  console.log('[articulo] crudo:', formData.get('precioManual'));
  console.log('[articulo] parseado:', d.precioManual, '| precioFijo:', d.precioFijo);

  // El precio lo resuelve el servidor: el navegador solo previsualiza.
  // Con precio manual, el valor ingresado manda y no se recalcula nunca
  // más desde el costo — ni acá ni en los ajustes masivos.
  const usarManual = !!d.precioManual && !!d.precioFijo && d.precioFijo > 0;

  if (d.precioManual && (!d.precioFijo || d.precioFijo <= 0)) {
    return {
      error: 'Ingresá el precio de venta o destildá la opción',
      campo: 'precioFijo',
    };
  }

  const precio = usarManual
    ? {
        precioBase: d.precioFijo!,
        redondeoAplicado: 0,
        precioFinal: d.precioFijo!,
      }
    : calcularPrecio({
        costoUnitario: d.costoUnitario,
        margenTipo: d.margenTipo,
        margenValor: d.margenValor,
        reglaRedondeo: d.reglaRedondeo,
      });

  // La validación aplica igual con precio manual: fijarlo es una decisión,
  // no una excusa para vender a pérdida sin verlo.
  const validacion = validarPrecio(d.costoUnitario, precio.precioFinal);
  if (!validacion.valido) {
    return {
      error: validacion.razon,
      campo: usarManual ? 'precioFijo' : 'margenValor',
    };
  }

  const supabase = await createClient();
  const id = formData.get('id') as string | null;

  const fila = {
    codigo_barras: d.codigoBarras || null,
    codigo_interno: d.codigoInterno || null,
    nombre: d.nombre,
    descripcion: d.descripcion || null,
    categoria_id: d.categoriaId || null,
    unidad: d.unidad,
    costo_unitario: d.costoUnitario,
    proveedor_principal_id: d.proveedorId || null,
    margen_tipo: d.margenTipo,
    margen_valor: d.margenValor,
    precio_venta_base: precio.precioBase,
    redondeo_aplicado: precio.redondeoAplicado,
    precio_venta_final: precio.precioFinal,
    precio_manual: usarManual,
    stock_minimo: d.stockMinimo,
    stock_maximo: d.stockMaximo || null,
  };

  const { error } = id
    ? await supabase.from('articulos').update(fila).eq('id', id)
    : await supabase.from('articulos').insert({ ...fila, activo: true });

  if (error) {
    if (error.code === '23505') {
      return {
        error: 'Ya existe un artículo con ese código de barras',
        campo: 'codigoBarras',
      };
    }
    return { error: error.message };
  }

  revalidatePath('/articulos');
  if (id) revalidatePath(`/articulos/${id}`);
  redirect('/articulos');
}

// ====================================================================
// Baja lógica
// ====================================================================

/**
 * Un artículo nunca se borra: el historial de ventas lo referencia.
 * Al desactivarlo desaparece del catálogo de la caja en la próxima
 * apertura, pero sigue apareciendo en los reportes históricos.
 */
export async function alternarActivoArticulo(id: string, activo: boolean) {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) return;

  const supabase = await createClient();
  await supabase.from('articulos').update({ activo }).eq('id', id);

  revalidatePath('/articulos');
  revalidatePath(`/articulos/${id}`);
}

// ====================================================================
// Stock
// ====================================================================

/**
 * Ajuste manual de stock, para conteos físicos o correcciones.
 * Queda registrado en historial_stock con el motivo y el usuario.
 */
export async function ajustarStock(
  articuloId: string,
  cantidadNueva: number,
  razon: string,
): Promise<EstadoForm> {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) {
    return { error: 'No tenés permisos para ajustar stock' };
  }

  if (!Number.isFinite(cantidadNueva) || cantidadNueva < 0) {
    return { error: 'La cantidad tiene que ser un número positivo' };
  }

  if (razon.trim().length < 3) {
    return { error: 'Indicá el motivo del ajuste' };
  }

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from('stock_sucursal')
    .select('cantidad_actual')
    .eq('articulo_id', articuloId)
    .eq('sucursal_id', sesion.sucursalId)
    .maybeSingle();

  const anterior = Number(actual?.cantidad_actual ?? 0);

  const { error } = await supabase.from('stock_sucursal').upsert(
    {
      articulo_id: articuloId,
      sucursal_id: sesion.sucursalId,
      cantidad_actual: cantidadNueva,
      ultimo_conteo: new Date().toISOString(),
    },
    { onConflict: 'articulo_id,sucursal_id' },
  );

  if (error) return { error: error.message };

  // Dejar rastro: dentro de tres meses esto es lo único que permite
  // reconstruir por qué el stock no cuadra.
  await supabase.from('historial_stock').insert({
    articulo_id: articuloId,
    sucursal_id: sesion.sucursalId,
    cantidad_anterior: anterior,
    cantidad_nueva: cantidadNueva,
    tipo_movimiento: 'ajuste',
    usuario_id: sesion.usuarioId,
    razon: razon.trim(),
  });

  revalidatePath('/articulos');
  revalidatePath(`/articulos/${articuloId}`);
  revalidatePath('/reportes/faltantes');
  return {};
}

// ====================================================================
// Categorías
// ====================================================================

export async function crearCategoria(nombre: string): Promise<EstadoForm> {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) {
    return { error: 'No tenés permisos' };
  }

  const limpio = nombre.trim();
  if (limpio.length < 2) return { error: 'El nombre es muy corto' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('categorias_articulos')
    .insert({ nombre: limpio });

  if (error) {
    return error.code === '23505'
      ? { error: 'Ya existe una categoría con ese nombre' }
      : { error: error.message };
  }

  revalidatePath('/articulos');
  return {};
}

// ====================================================================
// Precio manual
// ====================================================================

/**
 * Saca la marca de precio manual: el artículo vuelve a calcular su
 * precio desde el costo y el margen. Para cuando la razón que motivó
 * fijarlo ya no aplica.
 */
export async function liberarPrecioManual(
  articuloId: string,
): Promise<EstadoForm> {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) {
    return { error: 'No tenés permisos' };
  }

  const supabase = await createClient();

  const { data: articulo } = await supabase
    .from('articulos')
    .select('costo_unitario, margen_tipo, margen_valor')
    .eq('id', articuloId)
    .maybeSingle();

  if (!articulo) return { error: 'Artículo no encontrado' };

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('regla_redondeo')
    .eq('id', sesion.sucursalId)
    .maybeSingle();

  const precio = calcularPrecio({
    costoUnitario: Number(articulo.costo_unitario),
    margenTipo: articulo.margen_tipo,
    margenValor: Number(articulo.margen_valor),
    reglaRedondeo: sucursal?.regla_redondeo ?? 'al_peso',
  });

  const { error } = await supabase
    .from('articulos')
    .update({
      precio_manual: false,
      precio_venta_base: precio.precioBase,
      redondeo_aplicado: precio.redondeoAplicado,
      precio_venta_final: precio.precioFinal,
    })
    .eq('id', articuloId);

  if (error) return { error: error.message };

  revalidatePath('/articulos');
  revalidatePath(`/articulos/${articuloId}`);
  revalidatePath('/reportes/precios-fijos');
  return {};
}