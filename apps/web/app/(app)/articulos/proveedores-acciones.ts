'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';

const esquema = z.object({
  articuloId: z.string().uuid(),
  proveedorId: z.string().uuid('Elegí un proveedor'),
  codigoProveedor: z.string().trim().optional(),
  presentacion: z.string().trim().optional(),
  costo: z.coerce.number().min(0, 'El costo no puede ser negativo'),
  plazoEntrega: z.coerce.number().int().min(0).optional(),
  observaciones: z.string().trim().optional(),
});

export type EstadoProveedor = { error?: string; ok?: boolean };

export async function guardarProveedorArticulo(
  datos: unknown,
): Promise<EstadoProveedor> {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) return { error: 'Sin permisos' };

  const parsed = esquema.safeParse(datos);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from('articulos_proveedores').upsert(
    {
      articulo_id: d.articuloId,
      proveedor_id: d.proveedorId,
      codigo_proveedor: d.codigoProveedor || null,
      presentacion: d.presentacion || null,
      costo_proveedor: d.costo,
      plazo_entrega: d.plazoEntrega || null,
      observaciones: d.observaciones || null,
      activo: true,
    },
    { onConflict: 'articulo_id,proveedor_id' },
  );

  if (error) return { error: error.message };

  revalidatePath(`/articulos/${d.articuloId}`);
  return { ok: true };
}

export async function quitarProveedorArticulo(
  articuloId: string,
  proveedorId: string,
) {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) return;

  const supabase = await createClient();
  // Baja lógica: el historial de costos lo sigue referenciando
  await supabase
    .from('articulos_proveedores')
    .update({ activo: false })
    .eq('articulo_id', articuloId)
    .eq('proveedor_id', proveedorId);

  revalidatePath(`/articulos/${articuloId}`);
}

export async function definirPrincipal(
  articuloId: string,
  proveedorId: string,
  traerCosto: boolean,
): Promise<EstadoProveedor> {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) return { error: 'Sin permisos' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('definir_proveedor_principal', {
    p_articulo_id: articuloId,
    p_proveedor_id: proveedorId,
    p_traer_costo: traerCosto,
  });

  if (error) return { error: error.message };

  revalidatePath(`/articulos/${articuloId}`);
  revalidatePath('/articulos');
  return { ok: true };
}