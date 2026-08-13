'use client';

import { useEffect, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { registrarPago } from '@/lib/cobranza-manager';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { ClienteLocal, ReciboLocal } from '@/lib/db-local';

interface Props {
  cliente: ClienteLocal;
  cobradorId: string;
  puntoVenta: number;
  onEmitido: (recibo: ReciboLocal) => void;
  onCerrar: () => void;
}

const METODOS = [
  { valor: 'efectivo' as const, label: 'Efectivo' },
  { valor: 'billetera' as const, label: 'Billetera' },
  { valor: 'posnet' as const, label: 'Tarjeta' },
];

export function CobrarCliente({
  cliente, cobradorId, puntoVenta, onEmitido, onCerrar,
}: Props) {
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<'efectivo' | 'billetera' | 'posnet'>('efectivo');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  const valor = Number(monto.replace(',', '.')) || 0;
  const saldoNuevo = new Decimal(cliente.saldo).minus(valor).toNumber();
  const valido = valor > 0;

  async function confirmar() {
    if (!valido || guardando) return;
    setGuardando(true);
    setError('');

    try {
      const recibo = await registrarPago(
        cliente, cobradorId, puntoVenta, valor, metodo, observaciones,
      );
      onEmitido(recibo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar el pago');
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold">{cliente.nombre}</h2>
          <p className="text-sm text-neutral-500">
            Saldo actual {formatearPrecio(cliente.saldo)}
          </p>
        </div>

        <div>
          <label className="block text-sm text-neutral-500 mb-1.5">
            Monto que paga
          </label>
          <input
            ref={input}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmar()}
            inputMode="decimal"
            placeholder="0,00"
            className="w-full px-4 py-3 text-3xl font-mono text-right border
                       border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMonto(String(cliente.saldo))}
            className="py-2 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
          >
            Todo el saldo
          </button>
          <button
            onClick={() => setMonto(String(Math.round(cliente.saldo / 2)))}
            className="py-2 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
          >
            La mitad
          </button>
        </div>

        <div className="flex gap-2">
          {METODOS.map((m) => (
            <button
              key={m.valor}
              onClick={() => setMetodo(m.valor)}
              className={`flex-1 py-2 text-sm rounded border ${
                metodo === m.valor
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <input
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Observaciones (opcional)"
          className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
        />

        {valor > 0 && (
          <div className="bg-neutral-50 rounded p-4 text-center">
            <p className="text-sm text-neutral-500">Saldo después del pago</p>
            <p
              className={`text-2xl font-mono font-semibold ${
                saldoNuevo < 0 ? 'text-blue-700' : ''
              }`}
            >
              {formatearPrecio(saldoNuevo)}
            </p>
            {saldoNuevo < 0 && (
              <p className="text-xs text-blue-700 mt-1">
                Queda saldo a favor del cliente
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onCerrar}
            className="flex-1 py-2.5 border border-neutral-300 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!valido || guardando}
            className="flex-1 py-2.5 bg-neutral-900 text-white rounded font-medium disabled:opacity-30"
          >
            {guardando ? 'Registrando…' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}