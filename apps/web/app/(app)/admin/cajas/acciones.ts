'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';

export interface CajaAbiertaDetalle {
  id: string;
  fecha: string;
  vendedor: string;
  sucursal: string;
  efectivo_inicial: number;
  ventas_efectivo: number;
  egresos: number;
  ingresos: number;
  efectivo_esperado: number;
  total_vendido: number;
  dias_abierta: number;
}

export async function cajasAbiertasDetalle(): Promise<CajaAbiertaDetalle[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('cajas_abiertas_detalle');
  return (data ?? []) as CajaAbiertaDetalle[];
}

export async function cerrarCajaAdmin(
  cajaId: string,
  motivo: string,
): Promise<{ error?: string }> {
  const sesion = await getSesion();
  if (!['admin', 'gerente'].includes(sesion.rol)) {
    return { error: 'No tenés permisos para cerrar cajas de otros' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('cerrar_caja_admin', {
    p_caja_id: cajaId,
    p_motivo: motivo || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/cajas');
  revalidatePath('/reportes/arqueos');
  return {};
}