import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion, esAdmin } from '@/lib/sesion';
import { TablaUsuarios } from '@/components/admin/TablaUsuarios';

export default async function UsuariosPage() {
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();

  const [{ data: usuarios, error }, { data: sucursales }] = await Promise.all([
    supabase
      .from('usuarios')
      .select(
        'id, email, nombre, apellido, rol, sucursal_principal_id, activo',
      )
      .order('nombre'),
    supabase.from('sucursales').select('id, nombre').order('nombre'),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-verde-claro mt-0.5">
            <span className="num">{usuarios?.length ?? 0}</span> usuarios
            cargados
          </p>
        </div>

        <Link
          href="/admin/usuarios/nuevo"
          className="px-3 py-2 text-sm rounded-lg bg-verde-esmalte text-white
                     hover:bg-verde-hondo whitespace-nowrap"
        >
          Nuevo usuario
        </Link>
      </div>

      {error && (
        <p className="text-sm text-rojo-plomo font-mono">{error.message}</p>
      )}

      <TablaUsuarios
        usuarios={usuarios ?? []}
        sucursales={sucursales ?? []}
        yoId={sesion.usuarioId}
      />

      <p className="text-xs text-verde-claro">
        Para dar acceso a sucursales adicionales (multi-sucursal), entrá al
        detalle de cada usuario tocando su nombre en la tabla.
      </p>
    </div>
  );
}