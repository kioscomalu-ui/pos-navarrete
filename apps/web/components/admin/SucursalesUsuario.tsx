'use client';

import { useTransition } from 'react';
import { otorgarSucursalAccion, quitarSucursalAccion } from '@/app/(app)/admin/usuarios/acciones';

interface Props {
  usuarioId: string;
  sucursalPrincipalId: string;
  autorizadas: string[];         // ids de sucursal ya otorgadas
  todasLasSucursales: { id: string; nombre: string }[];
}

export function SucursalesUsuario({
  usuarioId,
  sucursalPrincipalId,
  autorizadas,
  todasLasSucursales,
}: Props) {
  const [pendiente, startTransition] = useTransition();

  function alternar(sucursalId: string, otorgada: boolean) {
    startTransition(() => {
      void (otorgada
        ? quitarSucursalAccion(usuarioId, sucursalId)
        : otorgarSucursalAccion(usuarioId, sucursalId));
    });
  }

  return (
    <div className="space-y-1">
      {todasLasSucursales.map((s) => {
        const esPrincipal = s.id === sucursalPrincipalId;
        const otorgada = esPrincipal || autorizadas.includes(s.id);

        return (
          <label
            key={s.id}
            className={`flex items-center gap-2 text-sm ${
              esPrincipal ? 'opacity-60' : 'cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={otorgada}
              disabled={esPrincipal || pendiente}
              onChange={() => alternar(s.id, otorgada)}
              className="accent-verde-esmalte"
            />
            <span>
              {s.nombre}
              {esPrincipal && (
                <span className="text-xs text-verde-claro ml-1.5">
                  (principal, no se puede quitar)
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}