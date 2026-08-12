'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-server';
import { calcularPrecio, validarPrecio } from '@pos/shared/utils/calcular-precio';

const esquema = z.object({
  codigoBarras: z.string().trim().optional(),
  codigoInterno: z.string().trim().optional(),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  categoriaId: z.string().uuid().optional().or(z.literal('')),
  unidad: z.enum(['unidad', 'kg', 'litro', 'metro']),
  costoUnitario: z.coerce.number().min(0),
  margenTipo: z.enum(['porcentaje', 'importe']),
  margenValor: z.coerce.number(),
  reglaRedondeo: z.enum(['sin_redondeo', 'al_peso', 'al_cincuenta', 'a_la_decena']),
  stockMinimo: z.coerce.number().min(0),
  proveedorId: z.string().uuid().optional().or(z.literal('')),
});

export type EstadoForm = { error?: string; campo?: string };

export async function guardarArticulo(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const parsed = esquema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    const primero = parsed.error.issues[0];
    return { error: primero.message, campo: String(primero.path[0]) };
  }

  const d = parsed.data;

  const precio = calcularPrecio({
    costoUnitario: d.costoUnitario,
    margenTipo: d.margenTipo,
    margenValor: d.margenValor,
    reglaRedondeo: d.reglaRedondeo,
  });

  const validacion = validarPrecio(d.costoUnitario, precio.precioFinal);
  if (!validacion.valido) {
    return { error: validacion.razon };
  }

  const supabase = await createClient();
  const id = formData.get('id') as string | null;

  const fila = {
    codigo_barras: d.codigoBarras || null,
    codigo_interno: d.codigoInterno || null,
    nombre: d.nombre,
    categoria_id: d.categoriaId || null,
    unidad: d.unidad,
    costo_unitario: d.costoUnitario,
    proveedor_principal_id: d.proveedorId || null,
    margen_tipo: d.margenTipo,
    margen_valor: d.margenValor,
    precio_venta_base: precio.precioBase,
    redondeo_aplicado: precio.redondeoAplicado,
    precio_venta_final: precio.precioFinal,
    stock_minimo: d.stockMinimo,
  };

  const { error } = id
    ? await supabase.from('articulos').update(fila).eq('id', id)
    : await supabase.from('articulos').insert(fila);

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe un artículo con ese código de barras', campo: 'codigoBarras' };
    }
    return { error: error.message };
  }

  revalidatePath('/articulos');
  redirect('/articulos');
}