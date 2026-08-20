'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { pagarProveedor } from '@/lib/caja-manager';

interface Proveedor {
  id: string;
  nombre: string;
}

interface Props {
  cajaId: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalPagoProveedor({ cajaId, onConfirmar, onCancelar }: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        setProveedores(data ?? []);
        setProveedorId((p) => p || data?.[0]?.id || '');
      });
  }, []);

  async function confirmar() {
    const n = Number(monto.replace(',', '.'));
    if (!proveedorId) {
      setError('Elegí un proveedor');
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError('Ingresá un monto válido');
      return;
    }

    setError('');
    setGuardando(true);
    try {
      await pagarProveedor(cajaId, n, proveedorId, motivo || undefined);
      onConfirmar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago');
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
        <h2 className="font-medium">Pagar a proveedor</h2>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">Proveedor</span>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="input"
          >
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
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
            placeholder="Ej: factura 0001-00012345"
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
            {guardando ? 'Guardando…' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}