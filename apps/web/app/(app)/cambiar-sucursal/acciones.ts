'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';

export interface ResultadoCambio {
  error?: string;
}

/**
 * Cambia la sucursal donde opera el usuario actual.
 * La validación de que esté autorizado y de que no tenga una caja
 * abierta en otra sucursal la hace la función de la base
 * (cambiar_sucursal_activa) — acá solo se traduce el resultado.
 */
export async function cambiarSucursal(sucursalId: string): Promise<ResultadoCambio> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('cambiar_sucursal_activa', {
    p_sucursal_id: sucursalId,
  });

  if (error) return { error: error.message };

  // Todo el árbol depende de sesion.sucursalId: hay que revalidar
  // desde la raíz para que caja, catálogo y reportes vean la sucursal nueva
  revalidatePath('/', 'layout');

  return {};
}