import { redirect } from 'next/navigation';
import { createClient } from './supabase-server';
import type { RolUsuario } from '@pos/shared/types';

export interface Sesion {
  usuarioId: string;
  nombre: string;
  apellido: string | null;
  rol: RolUsuario;
  /** Sucursal donde está operando ahora. Gobierna caja, stock y catálogo. */
  sucursalId: string;
  sucursalNombre: string;
  sucursalCodigo: string;
  /** Sucursal habitual del usuario. Para reportes por defecto e identidad. */
  sucursalPrincipalId: string;
}

/**
 * Lee la sesión actual y redirige a /login si no hay usuario válido.
 *
 * Se hacen dos consultas en vez de un join porque sucursales.gerente_id
 * genera ambigüedad en el join automático de PostgREST (dos caminos
 * posibles hacia la misma tabla).
 */
export async function getSesion(): Promise<Sesion> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('nombre, apellido, rol, sucursal_activa_id, sucursal_principal_id, activo')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil || !perfil.activo) redirect('/login');

  const { data: suc } = await supabase
    .from('sucursales')
    .select('nombre, codigo')
    .eq('id', perfil.sucursal_activa_id)
    .maybeSingle();

  return {
    usuarioId: user.id,
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    rol: perfil.rol,
    sucursalId: perfil.sucursal_activa_id,
    sucursalNombre: suc?.nombre ?? '',
    sucursalCodigo: suc?.codigo ?? '',
    sucursalPrincipalId: perfil.sucursal_principal_id,
  };
}

// ====================================================================
// Permisos por rol
// ====================================================================

export function puedeEditarCatalogo(rol: RolUsuario): boolean {
  return rol === 'admin' || rol === 'gerente';
}

export function puedeVerReportes(rol: RolUsuario): boolean {
  return rol === 'admin' || rol === 'gerente' || rol === 'supervisor';
}

export function puedeCobrar(rol: RolUsuario): boolean {
  return rol === 'admin' || rol === 'gerente' || rol === 'cobrador';
}

export function esAdmin(rol: RolUsuario): boolean {
  return rol === 'admin';
}