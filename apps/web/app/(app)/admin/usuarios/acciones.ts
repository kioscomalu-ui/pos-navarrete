'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getSesion, esAdmin } from '@/lib/sesion';

// ====================================================================
// Validación
// ====================================================================

const esquemaCrear = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(6, 'La contraseña necesita al menos 6 caracteres'),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  apellido: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  rol: z.enum(['admin', 'gerente', 'supervisor', 'vendedor', 'cobrador']),
  sucursalId: z.string().uuid('Elegí una sucursal'),
});

export type EstadoAlta = { error?: string; campo?: string; ok?: string };

// ====================================================================
// Crear
// ====================================================================

export async function crearUsuario(
  _prev: EstadoAlta,
  formData: FormData,
): Promise<EstadoAlta> {
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) return { error: 'Sin permisos' };

  const parsed = esquemaCrear.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const primero = parsed.error.issues[0];
    return { error: primero.message, campo: String(primero.path[0]) };
  }

  const d = parsed.data;
  const admin = createAdminClient();

  // 1. Crear en Auth. El trigger crea el perfil a partir de estos
  //    metadatos: 'sucursal_id' acá es la clave del JSON, no el
  //    nombre de la columna — no hay que tocarla aunque la columna
  //    real se llame distinto.
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
      campo: errAuth.message.includes('already registered') ? 'email' : undefined,
    };
  }

  // 2. El trigger ya creó la fila; completamos lo que el trigger no sabe
  //    (apellido, teléfono) y confirmamos sucursal principal y activa
  //    iguales al alta.
  const { error: errPerfil } = await admin
    .from('usuarios')
    .update({
      nombre: d.nombre,
      apellido: d.apellido || null,
      rol: d.rol,
      sucursal_principal_id: d.sucursalId,
      sucursal_activa_id: d.sucursalId,
      telefono: d.telefono || null,
    })
    .eq('id', auth.user.id);

  if (errPerfil) return { error: errPerfil.message };

 revalidatePath('/admin/usuarios');
  return { ok: `Usuario ${d.email} creado correctamente` };
}

// ====================================================================
// Edición rápida desde la tabla
// ====================================================================

export async function cambiarRol(usuarioId: string, rol: string) {
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) return;

  // Un admin no puede sacarse a sí mismo el rol de admin:
  // evita quedar todos afuera por error
  if (usuarioId === sesion.usuarioId && rol !== 'admin') return;

  const supabase = await createClient();
  await supabase.from('usuarios').update({ rol }).eq('id', usuarioId);

  revalidatePath('/admin/usuarios');
}

/**
 * Cambia la sucursal PRINCIPAL de un usuario (identidad, reportes por
 * defecto). Distinto de cambiar_sucursal_activa, que es el que usa el
 * propio usuario para elegir dónde está operando hoy.
 */
export async function cambiarSucursal(usuarioId: string, sucursalId: string) {
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) return;

  const supabase = await createClient();
  await supabase
    .from('usuarios')
    .update({ sucursal_principal_id: sucursalId })
    .eq('id', usuarioId);

  revalidatePath('/admin/usuarios');
}

export async function alternarActivo(usuarioId: string, activo: boolean) {
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) return;

  // Un admin no puede desactivarse a sí mismo
  if (usuarioId === sesion.usuarioId && !activo) return;

  const supabase = await createClient();
  await supabase.from('usuarios').update({ activo }).eq('id', usuarioId);

  revalidatePath('/admin/usuarios');
}

// ====================================================================
// Accesos a sucursales adicionales (multi-sucursal)
// ====================================================================

export async function otorgarSucursalAccion(usuarioId: string, sucursalId: string) {
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) return;

  const supabase = await createClient();
  await supabase.rpc('otorgar_sucursal', {
    p_usuario_id: usuarioId,
    p_sucursal_id: sucursalId,
  });

  revalidatePath('/admin/usuarios');
  revalidatePath(`/admin/usuarios/${usuarioId}`);
}

export async function quitarSucursalAccion(usuarioId: string, sucursalId: string) {
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) return;

  const supabase = await createClient();
  await supabase.rpc('quitar_sucursal', {
    p_usuario_id: usuarioId,
    p_sucursal_id: sucursalId,
  });

  revalidatePath('/admin/usuarios');
  revalidatePath(`/admin/usuarios/${usuarioId}`);
}