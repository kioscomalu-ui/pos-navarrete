import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { TablaUsuarios } from '@/components/admin/TablaUsuarios';
import { FormNuevoUsuario } from '@/components/admin/FormNuevoUsuario';

export default async function UsuariosPage() {
  const sesion = await getSesion();
  const supabase = await createClient();

  const [{ data: usuarios }, { data: sucursales }] = await Promise.all([
    supabase
      .from('usuarios')
      .select('id, email, nombre, apellido, rol, sucursal_id, activo')
      .order('nombre'),
    supabase.from('sucursales').select('id, nombre, codigo').order('nombre'),
  ]);

  return (
    <div className="space-y-6">
      <FormNuevoUsuario sucursales={sucursales ?? []} />
      <TablaUsuarios
        usuarios={usuarios ?? []}
        sucursales={sucursales ?? []}
        yoId={sesion.usuarioId}
      />
    </div>
  );
}