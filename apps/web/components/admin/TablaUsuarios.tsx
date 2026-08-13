'use client';

import { useTransition } from 'react';
import {
  cambiarRol,
  cambiarSucursal,
  alternarActivo,
} from '@/app/(app)/admin/usuarios/acciones';

const ROLES = ['admin', 'gerente', 'supervisor', 'vendedor', 'cobrador'];

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  rol: string;
  sucursal_id: string;
  activo: boolean;
}

export function TablaUsuarios({
  usuarios,
  sucursales,
  yoId,
}: {
  usuarios: Usuario[];
  sucursales: { id: string; nombre: string }[];
  yoId: string;
}) {
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="bg-white border border-neutral-200 rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left font-medium px-4 py-2.5">Usuario</th>
            <th className="text-left font-medium px-4 py-2.5">Rol</th>
            <th className="text-left font-medium px-4 py-2.5">Sucursal</th>
            <th className="text-right font-medium px-4 py-2.5">Estado</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-neutral-100">
          {usuarios.map((u) => {
            const soyYo = u.id === yoId;

            return (
              <tr
                key={u.id}
                className={`hover:bg-neutral-50 ${!u.activo ? 'opacity-50' : ''}`}
              >
                <td className="px-4 py-2.5">
                  <div>
                    {u.nombre} {u.apellido}
                    {soyYo && (
                      <span className="ml-2 text-xs text-neutral-400">vos</span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500">{u.email}</div>
                </td>

                <td className="px-4 py-2.5">
                  <select
                    value={u.rol}
                    disabled={soyYo || pendiente}
                    onChange={(e) =>
                      startTransition(() => {
                        void cambiarRol(u.id, e.target.value);
                      })
                    }
                    className="px-2 py-1 border border-neutral-300 rounded text-sm disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-2.5">
                  <select
                    value={u.sucursal_id}
                    disabled={pendiente}
                    onChange={(e) =>
                      startTransition(() => {
                        void cambiarSucursal(u.id, e.target.value);
                      })
                    }
                    className="px-2 py-1 border border-neutral-300 rounded text-sm"
                  >
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-2.5 text-right">
                  <button
                    disabled={soyYo || pendiente}
                    onClick={() =>
                      startTransition(() => {
                        void alternarActivo(u.id, !u.activo);
                      })
                    }
                    className="text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
                  >
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}