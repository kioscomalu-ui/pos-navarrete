'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase-admin';
import { getSesion } from '@/lib/sesion';

const esquemaAlta = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña necesita al menos 8 caracteres'),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  apellido: z.string().trim().optional(),
  rol: z.enum(['admin', 'gerente', 'vendedor', 'cobrador', 'supervisor']),
  sucursalId: z.string().uuid('Elegí una sucursal'),
  telefono: z.string().trim().optional(),
});

export type EstadoAlta = { error?: string; ok?: string };

export async function crearUsuario(
  _prev: EstadoAlta,
  formData: FormData,
): Promise<EstadoAlta> {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') return { error: 'Sin permisos' };

  const parsed = esquemaAlta.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;

  console.log('[articulo] crudo:', formData.get('precioManual'));
  console.log('[articulo] parseado:', d.precioManual, '| precioFijo:', d.precioFijo);
  
  const admin = createAdminClient();

  // 1. Crear en Auth
  const { data: auth, error: errAuth } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: {
      nombre: d.nombre,
      rol: d.rol,
      sucursal_id: d.sucursalId,
    },
  });

  if (errAuth) {
    return {
      error: errAuth.message.includes('already registered')
        ? 'Ya existe un usuario con ese email'
        : errAuth.message,
    };
  }

  // 2. El trigger crea el perfil; completamos lo que falta
  const { error: errPerfil } = await admin
    .from('usuarios')
    .update({
      nombre: d.nombre,
      apellido: d.apellido || null,
      rol: d.rol,
      sucursal_id: d.sucursalId,
      telefono: d.telefono || null,
    })
    .eq('id', auth.user.id);

  if (errPerfil) return { error: errPerfil.message };

  revalidatePath('/admin/usuarios');
  return { ok: `${d.nombre} puede entrar con ${d.email}` };
}

export async function cambiarRol(usuarioId: string, rol: string) {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') return;
  if (usuarioId === sesion.usuarioId) return; // no cambiarse el propio rol

  const admin = createAdminClient();
  await admin.from('usuarios').update({ rol }).eq('id', usuarioId);
  revalidatePath('/admin/usuarios');
}

export async function cambiarSucursal(usuarioId: string, sucursalId: string) {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') return;

  const admin = createAdminClient();
  await admin
    .from('usuarios')
    .update({ sucursal_id: sucursalId })
    .eq('id', usuarioId);
  revalidatePath('/admin/usuarios');
}

export async function alternarActivo(usuarioId: string, activo: boolean) {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') return;
  if (usuarioId === sesion.usuarioId) return; // no desactivarse a sí mismo

  const admin = createAdminClient();
  await admin.from('usuarios').update({ activo }).eq('id', usuarioId);
  revalidatePath('/admin/usuarios');
}