'use client';

import { useEffect, useState } from 'react';
import { transferirACaja, cajasAbiertas, type CajaAbierta } from '@/lib/caja-manager';

interface Props {
  cajaId: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalTransferenciaCaja({ cajaId, onConfirmar, onCancelar }: Props) {
  const [cajas, setCajas] = useState<CajaAbierta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [destinoId, setDestinoId] = useState('');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void cajasAbiertas()
      .then((cs) => {
        const otras = cs.filter((c) => c.id !== cajaId);
        setCajas(otras);
        setDestinoId(otras[0]?.id ?? '');
      })
      .catch(() => setError('No se pudo consultar qué cajas están abiertas'))
      .finally(() => setCargando(false));
  }, [cajaId]);

  async function confirmar() {
    const n = Number(monto.replace(',', '.'));
    if (!destinoId) {
      setError('Elegí a qué caja transferir');
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError('Ingresá un monto válido');
      return;
    }

    setError('');
    setGuardando(true);
    try {
      await transferirACaja(cajaId, destinoId, n, motivo || undefined);
      onConfirmar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la transferencia');
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
        <h2 className="font-medium">Transferir a otra caja</h2>

        {cargando ? (
          <p className="text-sm text-verde-claro py-4 text-center">Buscando cajas abiertas…</p>
        ) : cajas.length === 0 ? (
          <p className="text-sm text-verde-claro py-4 text-center">
            No hay otra caja abierta en este momento. Pedile a quien vas a
            transferirle que abra su caja primero.
          </p>
        ) : (
          <>
            <label className="block">
              <span className="block text-xs text-verde-claro mb-1">
                Transferir a
              </span>
              <select
                value={destinoId}
                onChange={(e) => setDestinoId(e.target.value)}
                className="input"
              >
                {cajas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.vendedor} · {c.sucursal}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs text-verde-claro mb-1">Monto</span>
              <input
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                autoFocus
                className="input num text-right"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-verde-claro mb-1">
                Motivo (opcional)
              </span>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: para vuelto"
                className="input"
              />
            </label>
          </>
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
            disabled={guardando || cajas.length === 0}
            className="flex-1 py-2.5 rounded bg-verde-esmalte text-white
                       font-medium text-sm disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : 'Transferir'}
          </button>
        </div>
      </div>
    </div>
  );
}