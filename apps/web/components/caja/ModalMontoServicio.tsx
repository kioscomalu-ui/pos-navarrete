'use client';

import { useState } from 'react';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Props {
  articulo: { id: string; nombre: string; comisionPorcentaje: number | null };
  onConfirmar: (monto: number) => void;
  onCancelar: () => void;
}

export function ModalMontoServicio({ articulo, onConfirmar, onCancelar }: Props) {
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');

  const n = Number(monto.replace(',', '.'));
  const comision = articulo.comisionPorcentaje ?? 0;
  const ganancia =
    Number.isFinite(n) && n > 0 ? Math.round(n * comision) / 100 : 0;

  function confirmar() {
    if (!Number.isFinite(n) || n <= 0) {
      setError('Ingresá un monto válido');
      return;
    }
    onConfirmar(n);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-mostrador rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="font-medium">{articulo.nombre}</h2>
          <p className="text-xs text-verde-claro mt-0.5">
            Comisión {comision}%
          </p>
        </div>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">
            Monto jugado / cargado
          </span>
          <input
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value);
              setError('');
            }}
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmar();
            }}
            className="input num text-right text-xl"
          />
        </label>

        {ganancia > 0 && (
          <p className="text-xs text-verde-claro">
            Te queda {formatearPrecio(ganancia)} de ganancia
          </p>
        )}

        {error && <p className="text-sm text-rojo-plomo">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded ring-1 ring-tiza/60 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            className="flex-1 py-2.5 rounded bg-verde-esmalte text-white
                       font-medium text-sm"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}