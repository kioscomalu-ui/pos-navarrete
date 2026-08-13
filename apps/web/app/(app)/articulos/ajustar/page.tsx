import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { AjustePrecios } from '@/components/articulos/AjustePrecios';

export default async function AjustarPage() {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();

  const [{ data: categorias }, { data: proveedores }] = await Promise.all([
    supabase.from('categorias_articulos').select('id, nombre').order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Ajustar precios
        </h1>
        <p className="text-sm text-verde-claro mt-1">
          Aplicá un porcentaje a un grupo de artículos y revisá el resultado
          antes de confirmar.
        </p>
      </div>

      <AjustePrecios
        categorias={categorias ?? []}
        proveedores={proveedores ?? []}
      />
    </div>
  );
}