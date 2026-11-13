'use client';

import { useEffect, useRef, useState } from 'react';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { CajaLocal } from '@/lib/db-local';

interface Props {
  nombreVendedor: string;
  sucursal: string;
  /** Cajas de días anteriores que quedaron sin cerrar */
  cajasViejas?: CajaLocal[];
  onCerrarVieja?: (caja: CajaLocal) => void;
  onAbrir: (efectivoInicial: number) => void;
  cargando: boolean;
}

export function AperturaCaja({
  nombreVendedor,
  sucursal,
  cajasViejas = [],
  onCerrarVieja,
  onAbrir,
  cargando,
}: Props) {
  const [monto, setMonto] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  const valor = Number(monto.replace(',', '.')) || 0;

  return (
    <div className="max-w-sm mx-auto py-16 space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">Abrir caja</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {nombreVendedor} · {sucursal}
        </p>
        <p className="text-sm text-neutral-500">
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </p>
      </div>

      {cajasViejas.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r p-4 space-y-3">
          <div>
            <p className="font-medium text-sm">
              {cajasViejas.length === 1
                ? 'Quedó una caja sin cerrar'
                : `Quedaron ${cajasViejas.length} cajas sin cerrar`}
            </p>
            <p className="text-xs text-neutral-600 mt-0.5">
              Abrí igual la de hoy. Las de atrás se cierran una por una, y
              cada una queda con el arqueo de su día.
            </p>
          </div>

          <div className="space-y-1.5">
            {cajasViejas.map((c) => (
              <button
                key={c.id}
                onClick={() => onCerrarVieja?.(c)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2
                           bg-white border border-amber-300 rounded text-sm
                           hover:border-amber-500"
              >
                <span>
                  {new Date(`${c.fecha}T12:00:00-03:00`).toLocaleDateString(
                    'es-AR',
                    { weekday: 'short', day: '2-digit', month: '2-digit' },
                  )}
                  <span className="text-neutral-500 font-mono ml-2">
                    {formatearPrecio(c.efectivoInicial)}
                  </span>
                </span>
                <span className="text-neutral-500 shrink-0">Cerrarla →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded p-6 space-y-4">
        <label className="block">
          <span className="block text-sm text-neutral-500 mb-1.5">
            Efectivo con el que arrancás
          </span>
          <input
            ref={input}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAbrir(valor)}
            inputMode="decimal"
            placeholder="0,00"
            className="w-full px-4 py-3 text-2xl font-mono text-right border
                       border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
          />
        </label>

        <p className="text-xs text-neutral-500">
          Contá el cambio antes de empezar. Este número es la base del arqueo
          al cerrar.
        </p>

        <button
          onClick={() => onAbrir(valor)}
          disabled={cargando}
          className="w-full py-3 bg-neutral-900 text-white rounded font-medium disabled:opacity-40"
        >
          {cargando ? 'Abriendo…' : `Abrir caja con ${formatearPrecio(valor)}`}
        </button>
      </div>
    </div>
  );
}