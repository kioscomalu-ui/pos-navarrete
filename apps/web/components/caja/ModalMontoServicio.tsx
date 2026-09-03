'use client';

import { useState } from 'react';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Props {
  articulo: {
    id: string;
    nombre: string;
    comisionPorcentaje: number | null;
    comisionSobreMonto: boolean;
  };
  onConfirmar: (monto: number) => void;
  onCancelar: () => void;
}

export function ModalMontoServicio({ articulo, onConfirmar, onCancelar }: Props) {
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');

  const n = Number(monto.replace(',', '.'));
  const valido = Number.isFinite(n) && n > 0;
  const comision = articulo.comisionPorcentaje ?? 0;

  // Con comisión sumada, el cliente paga el monto más el recargo.
  // Con comisión incluida, paga el monto y la ganancia sale de ahí.
  const ganancia = valido ? Math.round(n * comision) / 100 : 0;
  const aCobrar = valido
    ? articulo.comisionSobreMonto
      ? n + ganancia
      : n
    : 0;

  function confirmar() {
    if (!valido) {
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
            {articulo.comisionSobreMonto
              ? ' — se suma al monto'
              : ' — incluida en el monto'}
          </p>
        </div>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">
            {articulo.comisionSobreMonto
              ? 'Monto a cargar'
              : 'Monto jugado'}
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

        {valido && (
          <div className="bg-papel rounded p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-verde-claro">Cobrar al cliente</span>
              <span className="num font-semibold">
                {formatearPrecio(aCobrar)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-verde-claro">Queda de ganancia</span>
              <span className="num text-verde-claro">
                {formatearPrecio(ganancia)}
              </span>
            </div>
          </div>
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