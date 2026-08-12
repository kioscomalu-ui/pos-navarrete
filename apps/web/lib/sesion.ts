import { createClient } from './supabase-server';
import { redirect } from 'next/navigation';

export interface Sesion {
  usuarioId: string;
  nombre: string;
  apellido: string | null;
  rol: 'admin' | 'gerente' | 'vendedor' | 'cobrador' | 'supervisor';
  sucursalId: string;
  sucursalNombre: string;
  sucursalCodigo: string;
}

/** Devuelve la sesión o redirige al login. Usar en Server Components. */
export async function getSesion(): Promise<Sesion> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data } = await supabase
    .from('usuarios')
    .select('nombre, apellido, rol, sucursal_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) redirect('/login');

  const { data: suc } = await supabase
    .from('sucursales')
    .select('nombre, codigo')
    .eq('id', data.sucursal_id)
    .maybeSingle();

  return {
    usuarioId: user.id,
    nombre: data.nombre,
    apellido: data.apellido,
    rol: data.rol,
    sucursalId: data.sucursal_id,
    sucursalNombre: suc?.nombre ?? '',
    sucursalCodigo: suc?.codigo ?? '',
  };
}

export function puedeEditarCatalogo(rol: Sesion['rol']) {
  return rol === 'admin' || rol === 'gerente';
}