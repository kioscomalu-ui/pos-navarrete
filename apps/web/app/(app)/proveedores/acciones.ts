'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';

const esquema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  codigoProveedor: z
    .string()
    .trim()
    .min(2, 'El código es obligatorio')
    .regex(/^[A-Za-z0-9-]+$/, 'Solo letras, números y guiones'),
  cuit: z.string().trim().optional(),
  contacto: z.string().trim().optional(),
  vendedor: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  direccion: z.string().trim().optional(),
  localidad: z.string().trim().optional(),
  condicionesPago: z.string().trim().optional(),
  diasVisita: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
});

export type EstadoForm = { error?: string; campo?: string };

export async function guardarProveedor(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) {
    return { error: 'No tenés permisos para editar proveedores' };
  }

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
    codigo_proveedor: d.codigoProveedor.toUpperCase(),
    cuit: d.cuit || null,
    contacto: d.contacto || null,
    vendedor: d.vendedor || null,
    telefono: d.telefono || null,
    email: d.email || null,
    direccion: d.direccion || null,
    localidad: d.localidad || null,
    condiciones_pago: d.condicionesPago || null,
    dias_visita: d.diasVisita || null,
    observaciones: d.observaciones || null,
  };

  const { error } = id
    ? await supabase.from('proveedores').update(fila).eq('id', id)
    : await supabase.from('proveedores').insert({ ...fila, activo: true });

  if (error) {
    if (error.code === '23505') {
      return {
        error: 'Ya existe un proveedor con ese código',
        campo: 'codigoProveedor',
      };
    }
    return { error: error.message };
  }

  revalidatePath('/proveedores');
  redirect('/proveedores');
}

export async function alternarActivoProveedor(id: string, activo: boolean) {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) return;

  const supabase = await createClient();
  await supabase.from('proveedores').update({ activo }).eq('id', id);

  revalidatePath('/proveedores');
  revalidatePath(`/proveedores/${id}`);
}