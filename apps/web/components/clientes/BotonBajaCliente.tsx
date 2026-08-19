'use client';

import { useState, useTransition } from 'react';
import { alternarActivoCliente } from '@/app/(app)/clientes/acciones';

export function BotonBajaCliente({
  id,
  activo,
}: {
  id: string;
  activo: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  if (!activo) {
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-verde-claro">
          Este cliente está dado de baja. No va a aparecer para cargar ventas
          nuevas a cuenta corriente.
        </p>
        <button
          disabled={pendiente}
          onClick={() =>
            startTransition(() => {
              void alternarActivoCliente(id, true);
            })
          }
          className="text-xs text-verde-esmalte font-medium disabled:opacity-40"
        >
          Reactivar cliente
        </button>
      </div>
    );
  }

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
        className="text-xs text-verde-claro hover:text-rojo-plomo"
      >
        Dar de baja este cliente
      </button>
    );
  }

  return (
    <div className="bg-ambar-suave border-l-4 border-ambar-dial rounded-r p-4 space-y-3">
      <p className="text-xs">
        Deja de aparecer para cargar ventas nuevas a cuenta corriente. El
        saldo y el historial no se pierden.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirmando(false)}
          className="flex-1 py-2 text-xs rounded ring-1 ring-tiza"
        >
          Cancelar
        </button>
        <button
          disabled={pendiente}
          onClick={() =>
            startTransition(() => {
              void alternarActivoCliente(id, false);
            })
          }
          className="flex-1 py-2 text-xs rounded bg-rojo-plomo text-white
                     disabled:opacity-40"
        >
          {pendiente ? 'Dando de baja…' : 'Dar de baja'}
        </button>
      </div>
    </div>
  );
}