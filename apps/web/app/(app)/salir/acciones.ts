// ---------------------------------------------------------------------
// ARCHIVO NUEVO
// Guardar en: apps/web/app/(app)/salir/acciones.ts
// (hay que crear la carpeta "salir")
// ---------------------------------------------------------------------

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

/**
 * Cierra la sesión del usuario.
 *
 * La app no tenía ninguna forma de salir: la sesión quedaba abierta
 * para siempre en el dispositivo, así que quien empezaba el turno
 * siguiente vendía con el usuario del anterior y las ventas quedaban
 * a nombre equivocado.
 */
export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}