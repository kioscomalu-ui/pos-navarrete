'use client';

import { useEffect, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Props {
  total: number;
  onConfirmar: (recibido: number) => void;
  onCancelar: () => void;
}

/** Billetes que circulan, para los botones rápidos */
const BILLETES = [1000, 2000, 5000, 10000, 20000];

export function CobroEfectivo({ total, onConfirmar, onCancelar }: Props) {
  const [recibido, setRecibido] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  const monto = Number(recibido.replace(',', '.')) || 0;
  const vuelto = monto > 0 ? new Decimal(monto).minus(total).toNumber() : 0;
  const alcanza = monto >= total;

  /** Sugerencias: el importe exacto y los billetes que lo superan */
  const sugerencias = [
    total,
    ...BILLETES.filter((b) => b > total).slice(0, 3),
    Math.ceil(total / 1000) * 1000,
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4);

  function confirmar() {
    if (!alcanza) return;
    onConfirmar(monto);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="text-sm text-neutral-500">Total a cobrar</p>
          <p className="text-4xl font-mono font-semibold">{formatearPrecio(total)}</p>
        </div>

        <div>
          <label className="block text-sm text-neutral-500 mb-1.5">
            Recibido
          </label>
          <input
            ref={input}
            value={recibido}
            onChange={(e) => setRecibido(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
              if (e.key === 'Escape') { e.preventDefault(); onCancelar(); }
            }}
            inputMode="decimal"
            placeholder="0,00"
            className="w-full px-4 py-3 text-3xl font-mono text-right border border-neutral-300
                       rounded focus:outline-none focus:border-neutral-900"
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {sugerencias.map((s) => (
            <button
              key={s}
              onClick={() => setRecibido(String(s))}
              className="py-2 text-sm border border-neutral-300 rounded hover:bg-neutral-50 font-mono"
            >
              {s === total ? 'Justo' : s.toLocaleString('es-AR')}
            </button>
          ))}
        </div>

        <div
          className={`rounded p-4 text-center ${
            monto === 0
              ? 'bg-neutral-50 text-neutral-400'
              : alcanza
                ? 'bg-emerald-50'
                : 'bg-red-50 text-red-700'
          }`}
        >
          <p className="text-sm">
            {monto === 0 ? 'Vuelto' : alcanza ? 'Vuelto' : 'Falta'}
          </p>
          <p className="text-3xl font-mono font-semibold">
            {formatearPrecio(Math.abs(vuelto))}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="flex-1 py-2.5 border border-neutral-300 rounded"
          >
            Cancelar <kbd className="text-xs text-neutral-400">Esc</kbd>
          </button>
          <button
            onClick={confirmar}
            disabled={!alcanza}
            className="flex-1 py-2.5 bg-neutral-900 text-white rounded font-medium disabled:opacity-30"
          >
            Cobrar <kbd className="text-xs text-neutral-400">Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}