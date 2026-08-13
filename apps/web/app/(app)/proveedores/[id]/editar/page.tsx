import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { FormProveedor } from '@/components/proveedores/FormProveedor';

export default async function EditarProveedor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();
  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!proveedor) notFound();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        {proveedor.nombre}
      </h1>
      <FormProveedor proveedor={proveedor} />
    </div>
  );
}