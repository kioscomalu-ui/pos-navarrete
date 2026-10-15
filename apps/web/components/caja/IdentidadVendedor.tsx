// ---------------------------------------------------------------------
// ARCHIVO NUEVO
// Guardar en: apps/web/components/caja/IdentidadVendedor.tsx
// ---------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cerrarSesion } from '@/app/(app)/salir/acciones';

/** Minutos sin tocar la caja antes de preguntar quién está atendiendo */
const MINUTOS_INACTIVIDAD = 15;

interface Props {
  nombre: string;
  sucursal: string;
}

export function IdentidadVendedor({ nombre, sucursal }: Props) {
  const [preguntando, setPreguntando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const ultimaActividad = useRef(Date.now());

  useEffect(() => {
    const marcar = () => {
      ultimaActividad.current = Date.now();
    };

    const eventos = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true }));

    const reloj = setInterval(() => {
      const minutos = (Date.now() - ultimaActividad.current) / 60_000;
      if (minutos >= MINUTOS_INACTIVIDAD) setPreguntando(true);
    }, 30_000);

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, marcar));
      clearInterval(reloj);
    };
  }, []);

  const sigoYo = useCallback(() => {
    ultimaActividad.current = Date.now();
    setPreguntando(false);
  }, []);

  const salir = useCallback(async () => {
    setSaliendo(true);
    try {
      await cerrarSesion();
    } catch {
      // cerrarSesion redirige, y el redirect de Next llega como una
      // excepción. Si de verdad falló, el botón vuelve a habilitarse.
      setSaliendo(false);
    }
  }, []);

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 bg-mostrador ring-1
                   ring-tiza/60 rounded-lg px-4 py-2 mb-3"
      >
        <p className="text-sm truncate">
          <span className="text-verde-claro">Vendiendo como </span>
          <span className="font-medium">{nombre}</span>
          {sucursal && <span className="text-verde-claro"> · {sucursal}</span>}
        </p>

        <button
          onClick={() => void salir()}
          disabled={saliendo}
          className="shrink-0 px-3 py-1.5 text-xs rounded-lg ring-1 ring-tiza/60
                     hover:ring-verde-claro disabled:opacity-50"
        >
          {saliendo ? 'Saliendo…' : 'Cambiar vendedor'}
        </button>
      </div>

      {preguntando && (
        <div className="fixed inset-0 z-[60] bg-verde-hondo/95 flex items-center justify-center p-6">
          <div className="bg-mostrador rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="h-1.5 bg-ambar-dial" />

            <div className="px-7 py-8 text-center">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-verde-claro">
                ¿Quién está atendiendo?
              </p>

              <p className="text-3xl font-bold mt-3">{nombre}</p>

              <p className="text-sm text-verde-claro mt-4">
                La caja estuvo un rato sin usarse. Si cambió el turno, salí y
                entrá con tu usuario: las ventas se registran a nombre de quien
                tiene la sesión abierta.
              </p>
            </div>

            <div className="px-5 pb-5 space-y-2">
              <button
                onClick={sigoYo}
                className="w-full py-3.5 rounded-lg bg-verde-esmalte text-white
                           font-medium hover:bg-verde-hondo"
              >
                Sigo yo, {nombre}
              </button>

              <button
                onClick={() => void salir()}
                disabled={saliendo}
                className="w-full py-3 rounded-lg bg-mostrador ring-1 ring-tiza/60
                           hover:ring-verde-claro disabled:opacity-50"
              >
                {saliendo ? 'Saliendo…' : 'Es otra persona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}