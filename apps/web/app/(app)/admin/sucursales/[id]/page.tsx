import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { FormSucursal } from '@/components/admin/FormSucursal';

export default async function EditarSucursal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!sucursal) notFound();

  return (
    <div className="space-y-6">
      <h2 className="font-medium">{sucursal.nombre}</h2>
      <FormSucursal sucursal={sucursal} />
    </div>
  );
}