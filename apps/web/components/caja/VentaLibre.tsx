'use client';

import { useEffect, useRef, useState } from 'react';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Props {
  onConfirmar: (descripcion: string, precio: number, cantidad: number) => void;
  onCerrar: () => void;
}

export function VentaLibre({ onConfirmar, onCerrar }: Props) {
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const inputDescripcion = useRef<HTMLInputElement>(null);
  const inputPrecio = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputDescripcion.current?.focus();
  }, []);

  const monto = Number(precio.replace(',', '.')) || 0;
  const cant = Number(cantidad.replace(',', '.')) || 0;
  const total = Math.round(monto * cant * 100) / 100;
  const valido = monto > 0 && cant > 0;

  function confirmar() {
    if (!valido) return;
    onConfirmar(descripcion, monto, cant);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-mostrador rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="font-medium">Venta libre</h2>
          <p className="text-xs text-verde-claro mt-0.5">
            Para algo que todavía no está cargado en el sistema
          </p>
        </div>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">
            Qué es (opcional)
          </span>
          <input
            ref={inputDescripcion}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') inputPrecio.current?.focus();
              if (e.key === 'Escape') onCerrar();
            }}
            placeholder="Artículo varios"
            className="input"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-verde-claro mb-1">Precio</span>
            <input
              ref={inputPrecio}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmar();
                if (e.key === 'Escape') onCerrar();
              }}
              inputMode="decimal"
              placeholder="0,00"
              className="input num text-right text-lg"
            />
          </label>

          <label className="block">
            <span className="block text-xs text-verde-claro mb-1">
              Cantidad
            </span>
            <input
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmar()}
              inputMode="decimal"
              className="input num text-right text-lg"
            />
          </label>
        </div>

        {monto > 0 && cant > 0 && (
          <div className="bg-papel rounded p-3 text-center">
            <span className="text-xs text-verde-claro">Subtotal</span>
            <div className="num text-2xl font-semibold">
              {formatearPrecio(total)}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCerrar}
            className="flex-1 py-2.5 rounded ring-1 ring-tiza/60 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!valido}
            className="flex-1 py-2.5 rounded bg-verde-esmalte text-white
                       font-medium text-sm disabled:opacity-30"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}