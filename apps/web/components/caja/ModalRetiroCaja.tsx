'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  cajaId: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const DESTINOS = [
  'Caja fuerte',
  'Se lo llevó el encargado',
  'Depósito bancario',
  'Otro',
];

export function ModalRetiroCaja({ cajaId, onConfirmar, onCancelar }: Props) {
  const [monto, setMonto] = useState('');
  const [destino, setDestino] = useState(DESTINOS[0]);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    const n = Number(monto.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      setError('Ingresá un monto válido');
      return;
    }

    const motivo =
      destino === 'Otro' ? detalle.trim() : `${destino}${detalle ? ` · ${detalle}` : ''}`;

    if (motivo.length < 3) {
      setError('Indicá a dónde va la plata');
      return;
    }

    setError('');
    setGuardando(true);
    try {
      const { error: err } = await supabase.rpc('registrar_retiro_caja', {
        p_caja_id: cajaId,
        p_monto: n,
        p_motivo: motivo,
      });
      if (err) throw err;
      onConfirmar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el retiro');
    } finally {
      setGuardando(false);
    }
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
          <h2 className="font-medium">Retirar efectivo</h2>
          <p className="text-xs text-verde-claro mt-0.5">
            Para cuando sacás plata del cajón durante el día. Si no queda
            registrado, al cerrar va a aparecer como faltante.
          </p>
        </div>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">Monto</span>
          <input
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value);
              setError('');
            }}
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            className="input num text-right text-lg"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">
            ¿A dónde va?
          </span>
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="input"
          >
            {DESTINOS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">
            {destino === 'Otro' ? 'Detalle' : 'Detalle (opcional)'}
          </span>
          <input
            value={detalle}
            onChange={(e) => {
              setDetalle(e.target.value);
              setError('');
            }}
            placeholder={
              destino === 'Otro' ? 'Explicá a dónde fue' : 'Ej: se lo di a Elsa'
            }
            className="input"
          />
        </label>

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
            disabled={guardando}
            className="flex-1 py-2.5 rounded bg-verde-esmalte text-white
                       font-medium text-sm disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : 'Registrar retiro'}
          </button>
        </div>
      </div>
    </div>
  );
}