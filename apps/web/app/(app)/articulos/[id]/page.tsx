import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { redirect, notFound } from 'next/navigation';
import { FormArticulo } from '@/components/articulos/FormArticulo';

export const dynamic = 'force-dynamic';

export default async function EditarArticulo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();

  const [{ data: articulo }, { data: categorias }, { data: proveedores }, { data: sucursal }] =
    await Promise.all([
      supabase.from('articulos').select('*').eq('id', id).maybeSingle(),
      supabase.from('categorias_articulos').select('id, nombre').order('nombre'),
      supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('sucursales').select('regla_redondeo').eq('id', sesion.sucursalId).single(),
    ]);

  if (!articulo) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{articulo.nombre}</h1>
      <FormArticulo
        articulo={articulo}
        categorias={categorias ?? []}
        proveedores={proveedores ?? []}
        reglaDefault={sucursal?.regla_redondeo ?? 'al_peso'}
      />
    </div>
  );
}