'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cambiarSucursal } from '@/app/(app)/cambiar-sucursal/acciones';

interface Props {
  sucursalActual: string;
  sucursales: { id: string; nombre: string; esPrincipal: boolean }[];
}

export function SelectorSucursal({ sucursalActual, sucursales }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [pendiente, startTransition] = useTransition();

  // Con una sola sucursal autorizada, el selector no aporta nada
  if (sucursales.length <= 1) return null;

  function elegir(id: string) {
    if (id === sucursalActual) {
      setAbierto(false);
      return;
    }

    startTransition(async () => {
      const r = await cambiarSucursal(id);
      if (r.error) {
        setError(r.error);
        setTimeout(() => setError(''), 4000);
        return;
      }
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((a) => !a)}
        className="text-xs text-tiza hover:text-white flex items-center gap-1
                   transition-colors"
      >
        Cambiar sucursal
        <span className="text-[0.6rem]">▾</span>
      </button>

      {abierto && (
        <>
          {/* Capa invisible para cerrar al tocar afuera */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAbierto(false)}
          />

          <div
            className="absolute right-0 top-full mt-2 w-56 bg-mostrador
                       rounded-lg shadow-xl ring-1 ring-tiza/60 z-50 overflow-hidden"
          >
            {sucursales.map((s) => (
              <button
                key={s.id}
                onClick={() => elegir(s.id)}
                disabled={pendiente}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center
                           justify-between hover:bg-papel disabled:opacity-50
                           text-verde-esmalte ${
                  s.id === sucursalActual ? 'font-medium' : ''
                }`}
              >
                <span>
                  {s.nombre}
                  {s.esPrincipal && (
                    <span className="text-xs text-verde-claro ml-1.5 font-normal">
                      principal
                    </span>
                  )}
                </span>
                {s.id === sucursalActual && (
                  <span className="text-verde-esmalte">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div
          className="absolute right-0 top-full mt-2 w-56 bg-rojo-plomo text-white
                     text-xs rounded-lg px-3 py-2 z-50 shadow-lg"
        >
          {error}
        </div>
      )}
    </div>
  );
}