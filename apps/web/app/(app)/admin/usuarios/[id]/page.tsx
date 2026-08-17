import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion, esAdmin } from '@/lib/sesion';
import { SucursalesUsuario } from '@/components/admin/SucursalesUsuario';

const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
  cobrador: 'Cobrador',
};

export default async function DetalleUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();

  const [{ data: usuario }, { data: sucursales }, { data: autorizadas }] =
    await Promise.all([
      supabase
        .from('usuarios')
        .select(
          'id, nombre, apellido, email, telefono, rol, sucursal_principal_id, sucursal_activa_id, activo',
        )
        .eq('id', id)
        .maybeSingle(),

      supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre'),

      supabase
        .from('usuario_sucursales')
        .select('sucursal_id')
        .eq('usuario_id', id),
    ]);

  if (!usuario) notFound();

  const sucursalPrincipal = sucursales?.find(
    (s) => s.id === usuario.sucursal_principal_id,
  );
  const sucursalActiva = sucursales?.find(
    (s) => s.id === usuario.sucursal_activa_id,
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {usuario.nombre} {usuario.apellido ?? ''}
        </h1>
        <p className="text-sm text-verde-claro mt-0.5">{usuario.email}</p>
      </div>

      {/* --- Datos básicos --- */}
      <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-verde-claro">Rol</dt>
            <dd>{ETIQUETA_ROL[usuario.rol] ?? usuario.rol}</dd>
          </div>
          <div>
            <dt className="text-xs text-verde-claro">Estado</dt>
            <dd className={usuario.activo ? 'text-verde-claro' : 'text-rojo-plomo'}>
              {usuario.activo ? 'Activo' : 'Inactivo'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-verde-claro">Teléfono</dt>
            <dd>{usuario.telefono || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-verde-claro">Sucursal principal</dt>
            <dd>{sucursalPrincipal?.nombre ?? '—'}</dd>
          </div>
          {usuario.sucursal_activa_id !== usuario.sucursal_principal_id && (
            <div className="col-span-2">
              <dt className="text-xs text-ambar-dial">Operando hoy en</dt>
              <dd>{sucursalActiva?.nombre ?? '—'}</dd>
            </div>
          )}
        </dl>

        <p className="text-xs text-verde-claro/70 mt-4">
          El rol, la sucursal principal y el estado se cambian desde la fila
          de este usuario en el listado.
        </p>
      </section>

      {/* --- Sucursales adicionales --- */}
      <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-3">
        <div>
          <h2 className="text-sm font-medium">Sucursales autorizadas</h2>
          <p className="text-xs text-verde-claro mt-0.5">
            Además de la principal, puede operar en las que marques acá. Va a
            poder elegir entre estas desde el selector de la barra superior.
          </p>
        </div>

        <SucursalesUsuario
          usuarioId={usuario.id}
          sucursalPrincipalId={usuario.sucursal_principal_id}
          autorizadas={(autorizadas ?? []).map((a) => a.sucursal_id)}
          todasLasSucursales={sucursales ?? []}
        />
      </section>
    </div>
  );
}