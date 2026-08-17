import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion, esAdmin } from '@/lib/sesion';

interface UsuarioFila {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  rol: string;
  sucursal_principal_id: string;
  sucursal_activa_id: string;
  activo: boolean;
}

const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
  cobrador: 'Cobrador',
};

export default async function UsuariosPage() {
  const sesion = await getSesion();
  if (!esAdmin(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();

  const [{ data: usuarios, error }, { data: sucursales }] = await Promise.all([
    supabase
      .from('usuarios')
      .select(
        'id, email, nombre, apellido, rol, sucursal_principal_id, sucursal_activa_id, activo',
      )
      .order('nombre'),
    supabase.from('sucursales').select('id, nombre, codigo').order('nombre'),
  ]);

  const mapaSucursales = new Map(
    (sucursales ?? []).map((s) => [s.id, s.nombre]),
  );

  const filas = (usuarios ?? []) as UsuarioFila[];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-verde-claro mt-0.5">
            <span className="num">{filas.length}</span> usuarios cargados
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

      <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[40rem]">
            <thead className="bg-papel text-verde-claro text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Nombre</th>
                <th className="text-left font-medium px-4 py-2.5">Email</th>
                <th className="text-left font-medium px-4 py-2.5">Rol</th>
                <th className="text-left font-medium px-4 py-2.5">Sucursal</th>
                <th className="text-left font-medium px-4 py-2.5">Estado</th>
                <th className="w-16 px-4 py-2.5"></th>
              </tr>
            </thead>

            <tbody>
              {filas.map((u, i) => {
                const principal = mapaSucursales.get(u.sucursal_principal_id);
                const activa = mapaSucursales.get(u.sucursal_activa_id);
                const trabajandoEnOtra =
                  u.sucursal_activa_id !== u.sucursal_principal_id;

                return (
                  <tr
                    key={u.id}
                    className={`${
                      i % 2 === 0 ? 'renglon-impar' : 'renglon-par'
                    } ${!u.activo ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/usuarios/${u.id}`}
                        className="hover:underline font-medium"
                      >
                        {u.nombre} {u.apellido ?? ''}
                      </Link>
                    </td>

                    <td className="px-4 py-2.5 text-verde-claro">{u.email}</td>

                    <td className="px-4 py-2.5">
                      {ETIQUETA_ROL[u.rol] ?? u.rol}
                    </td>

                    <td className="px-4 py-2.5">
                      {principal ?? '—'}
                      {trabajandoEnOtra && (
                        <span
                          className="ml-2 text-xs text-ambar-dial"
                          title="Está operando en otra sucursal en este momento"
                        >
                          hoy en {activa}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      {u.activo ? (
                        <span className="text-verde-claro">Activo</span>
                      ) : (
                        <span className="text-rojo-plomo">Inactivo</span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/usuarios/${u.id}`}
                        className="text-xs text-verde-claro hover:text-verde-esmalte"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filas.length === 0 && !error && (
          <p className="px-4 py-12 text-center text-sm text-verde-claro/70">
            Todavía no hay usuarios cargados
          </p>
        )}
      </div>
    </div>
  );
}