'use client';

import { useTransition } from 'react';
import { alternarActivaSucursal } from '@/app/(app)/admin/sucursales/acciones';

export function BotonActivarSucursal({
  id,
  activa,
  esPropia,
}: {
  id: string;
  activa: boolean;
  esPropia: boolean;
}) {
  const [pendiente, startTransition] = useTransition();

  // No se puede desactivar la sucursal en la que estás trabajando
  if (esPropia && activa) return null;

  return (
    <button
      disabled={pendiente}
      onClick={() =>
        startTransition(() => {
          void alternarActivaSucursal(id, !activa);
        })
      }
      className="text-sm text-verde-claro hover:text-verde-esmalte disabled:opacity-40"
    >
      {activa ? 'Desactivar' : 'Activar'}
    </button>
  );
}