'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';

const esquema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  codigo: z
    .string()
    .trim()
    .min(3, 'El código necesita al menos 3 caracteres')
    .regex(/^[A-Z0-9]+$/, 'Solo mayúsculas y números, sin espacios'),
  puntoVenta: z.coerce
    .number()
    .int('Tiene que ser un número entero')
    .min(1, 'El punto de venta arranca en 1'),
  ciudad: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  zona: z.string().trim().optional(),
  reglaRedondeo: z.enum([
    'sin_redondeo',
    'al_peso',
    'al_cincuenta',
    'a_la_decena',
  ]),
  margenDefault: z.coerce.number().min(0).max(1000),
  umbralDiferencia: z.coerce.number().min(0),
  diasRetencionLocal: z.coerce.number().int().min(7).max(365),
});

export type EstadoForm = { error?: string; campo?: string };

export async function guardarSucursal(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') return { error: 'Sin permisos' };

  const parsed = esquema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const primero = parsed.error.issues[0];
    return { error: primero.message, campo: String(primero.path[0]) };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const id = formData.get('id') as string | null;

  const fila = {
    nombre: d.nombre,
    codigo: d.codigo,
    punto_venta: d.puntoVenta,
    ciudad: d.ciudad || null,
    direccion: d.direccion || null,
    telefono: d.telefono || null,
    zona: d.zona || null,
    regla_redondeo: d.reglaRedondeo,
    margen_default: d.margenDefault,
    umbral_diferencia_caja: d.umbralDiferencia,
    dias_retencion_local: d.diasRetencionLocal,
  };

  const { error } = id
    ? await supabase.from('sucursales').update(fila).eq('id', id)
    : await supabase.from('sucursales').insert(fila);

  if (error) {
    if (error.code === '23505') {
      return error.message.includes('punto_venta')
        ? {
            error: 'Ya hay una sucursal con ese punto de venta',
            campo: 'puntoVenta',
          }
        : { error: 'Ya existe una sucursal con ese código', campo: 'codigo' };
    }
    return { error: error.message };
  }

  revalidatePath('/admin/sucursales');
  redirect('/admin/sucursales');
}

export async function alternarActivaSucursal(id: string, activa: boolean) {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') return;
  // No desactivar la sucursal donde estás trabajando
  if (id === sesion.sucursalId && !activa) return;

  const supabase = await createClient();
  await supabase.from('sucursales').update({ activa }).eq('id', id);
  revalidatePath('/admin/sucursales');
}