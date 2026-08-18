'use server';

import { createClient } from '@/lib/supabase-server';

export interface ResultadoPassword {
  error?: string;
  ok?: boolean;
}

/**
 * Cambia la contraseña del usuario que tiene la sesión activa.
 * No depende del rol: cualquiera puede cambiar SU PROPIA clave.
 * La gestión de contraseñas de OTROS usuarios sigue siendo admin-only,
 * en /admin/usuarios/acciones.ts — esto es una función separada.
 */
export async function cambiarMiPassword(
  actual: string,
  nueva: string,
): Promise<ResultadoPassword> {
  if (nueva.length < 6) {
    return { error: 'La contraseña nueva necesita al menos 6 caracteres' };
  }
  if (actual === nueva) {
    return { error: 'La contraseña nueva tiene que ser distinta de la actual' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: 'No se pudo identificar la sesión' };
  }

  // Confirmar identidad con la clave actual antes de cambiarla.
  // Sin esto, cualquiera que encuentre una sesión abierta sin
  // vigilancia podría cambiar la contraseña sin saber la anterior.
  const { error: errVerificar } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: actual,
  });

  if (errVerificar) {
    return { error: 'La contraseña actual no es correcta' };
  }

  const { error: errCambio } = await supabase.auth.updateUser({
    password: nueva,
  });

  if (errCambio) return { error: errCambio.message };

  return { ok: true };
}