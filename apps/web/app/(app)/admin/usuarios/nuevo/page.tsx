import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion, esAdmin } from '@/lib/sesion';
import { FormNuevoUsuario } from '@/components/admin/FormNuevoUsuario';

export default async function NuevoUsuarioPage() {
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();
  const { data: sucursales } = await supabase
    .from('sucursales')
    .select('id, nombre, codigo')
    .eq('activa', true)
    .order('nombre');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo usuario</h1>
        <p className="text-sm text-verde-claro mt-1">
          Va a poder entrar apenas le compartas el email y la contraseña.
        </p>
      </div>

      <FormNuevoUsuario sucursales={sucursales ?? []} />
    </div>
  );
}