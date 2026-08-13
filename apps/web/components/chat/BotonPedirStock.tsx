'use client';

import { useEffect, useState } from 'react';
import { pedirStock, canalesLocales } from '@/lib/chat-manager';
import type { ContextoChat } from '@/lib/chat-manager';
import type { CanalLocal } from '@/lib/db-local';

interface Props {
  articulo: { id: string; nombre: string };
  ctx: ContextoChat;
}

export function BotonPedirStock({ articulo, ctx }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [canales, setCanales] = useState<CanalLocal[]>([]);
  const [canal, setCanal] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    void canalesLocales().then((cs) => {
      setCanales(cs);
      setCanal((c) => c || cs[0]?.id || '');
    });
  }, [abierto]);

  async function pedir() {
    const n = Number(cantidad);
    if (!canal || !Number.isFinite(n) || n <= 0) return;

    setEnviando(true);
    try {
      await pedirStock(ctx, canal, articulo, n);
      setEnviado(true);
      setTimeout(() => {
        setAbierto(false);
        setEnviado(false);
      }, 1200);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="text-xs text-neutral-400 hover:text-neutral-900"
        title="Pedir a otra sucursal"
      >
        Pedir
      </button>

      {abierto && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {enviado ? (
              <p className="py-8 text-center text-emerald-700">
                Pedido enviado
              </p>
            ) : (
              <>
                <div>
                  <h2 className="font-semibold">Pedir mercadería</h2>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {articulo.nombre}
                  </p>
                </div>

                <label className="block">
                  <span className="block text-xs text-neutral-500 mb-1">
                    Cantidad
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-right font-mono"
                  />
                </label>

                <label className="block">
                  <span className="block text-xs text-neutral-500 mb-1">
                    Enviar a
                  </span>
                  <select
                    value={canal}
                    onChange={(e) => setCanal(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded"
                  >
                    {canales.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                {canales.length === 0 && (
                  <p className="text-xs text-neutral-500">
                    No hay canales cargados. Abrí el panel de mensajes una vez
                    con conexión.
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setAbierto(false)}
                    className="flex-1 py-2 border border-neutral-300 rounded text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={pedir}
                    disabled={enviando || !canal}
                    className="flex-1 py-2 bg-neutral-900 text-white rounded text-sm disabled:opacity-30"
                  >
                    {enviando ? 'Enviando…' : 'Pedir'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}