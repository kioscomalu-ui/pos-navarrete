import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { redirect } from 'next/navigation';
import { FormArticulo } from '@/components/articulos/FormArticulo';

export default async function NuevoArticulo() {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();

  const [{ data: categorias }, { data: proveedores }, { data: sucursal }] =
    await Promise.all([
      supabase.from('categorias_articulos').select('id, nombre').order('nombre'),
      supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('sucursales').select('regla_redondeo').eq('id', sesion.sucursalId).single(),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo artículo</h1>
      <FormArticulo
        categorias={categorias ?? []}
        proveedores={proveedores ?? []}
        reglaDefault={sucursal?.regla_redondeo ?? 'al_peso'}
      />
    </div>
  );
}