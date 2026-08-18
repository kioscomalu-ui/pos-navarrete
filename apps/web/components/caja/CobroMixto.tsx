'use client';

import { useMemo, useState } from 'react';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { DesglosePago } from '@/lib/venta-engine';

interface Props {
  total: number;
  onConfirmar: (pagos: DesglosePago[], recibidoEfectivo?: number) => void;
  onCancelar: () => void;
}

const METODOS: { valor: DesglosePago['metodo']; label: string }[] = [
  { valor: 'efectivo', label: 'Efectivo' },
  { valor: 'posnet', label: 'Tarjeta' },
  { valor: 'billetera', label: 'Billetera' },
  { valor: 'cuenta_corriente', label: 'Cta. corriente' },
];

export function CobroMixto({ total, onConfirmar, onCancelar }: Props) {
  const [montos, setMontos] = useState<Record<string, string>>({});

  const pagos: DesglosePago[] = useMemo(
    () =>
      METODOS.map((m) => ({
        metodo: m.valor,
        monto: Number((montos[m.valor] ?? '').replace(',', '.')) || 0,
      })).filter((p) => p.monto > 0),
    [montos],
  );

  const suma = pagos.reduce((a, p) => a + p.monto, 0);
  const resta = Math.round((total - suma) * 100) / 100;
  const completo = Math.abs(resta) < 0.01 && pagos.length > 0;

  function completarConEfectivo() {
    if (resta <= 0) return;
    setMontos((m) => ({
      ...m,
      efectivo: (Number((m.efectivo ?? '0').replace(',', '.')) + resta).toFixed(2),
    }));
  }

  function confirmar() {
    if (!completo) return;
    const parteEfectivo = pagos.find((p) => p.metodo === 'efectivo');
    onConfirmar(pagos, parteEfectivo?.monto);
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
          <h2 className="font-medium">Pago combinado</h2>
          <p className="num text-sm text-verde-claro">
            Total {formatearPrecio(total)}
          </p>
        </div>

        <div className="space-y-2.5">
          {METODOS.map((m) => (
            <label key={m.valor} className="flex items-center gap-3">
              <span className="text-sm w-28 shrink-0">{m.label}</span>
              <input
                value={montos[m.valor] ?? ''}
                onChange={(e) =>
                  setMontos((prev) => ({ ...prev, [m.valor]: e.target.value }))
                }
                inputMode="decimal"
                placeholder="0,00"
                className="input num text-right"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={completarConEfectivo}
          disabled={resta <= 0}
          className="w-full py-2 text-xs text-verde-claro hover:text-verde-esmalte
                     disabled:opacity-30"
        >
          Completar el resto en efectivo
        </button>

        <div
          className={`rounded p-3 text-center ${
            completo ? 'bg-papel' : 'bg-ambar-suave'
          }`}
        >
          {completo ? (
            <span className="text-sm text-verde-esmalte font-medium">
              Cubre el total
            </span>
          ) : (
            <span className="num text-sm">
              {resta > 0 ? 'Falta' : 'Sobra'} {formatearPrecio(Math.abs(resta))}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded ring-1 ring-tiza/60 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!completo}
            className="flex-1 py-2.5 rounded bg-verde-esmalte text-white
                       font-medium text-sm disabled:opacity-30"
          >
            Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}