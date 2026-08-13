'use client';

import { useEffect, useRef, useState } from 'react';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Props {
  nombreVendedor: string;
  sucursal: string;
  onAbrir: (efectivoInicial: number) => void;
  cargando: boolean;
}

export function AperturaCaja({ nombreVendedor, sucursal, onAbrir, cargando }: Props) {
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