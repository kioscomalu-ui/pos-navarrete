'use client';

import { useState } from 'react';
import { responderPedido } from '@/lib/chat-manager';
import { catalogo } from '@/lib/catalogo-cache';
import type { MensajeLocal } from '@/lib/db-local';

interface Props {
  mensaje: MensajeLocal;
  propio: boolean;
  onResponder: () => void;
}

export function TarjetaPedidoStock({ mensaje, propio, onResponder }: Props) {
  const [enviando, setEnviando] = useState(false);

  const meta = (mensaje.metadata ?? {}) as {
    articuloId?: string;
    articuloNombre?: string;
    cantidad?: number;
    estado?: string;
  };

  const stockPropio = meta.articuloId ? catalogo.stockDe(meta.articuloId) : null;

  async function responder(estado: 'confirmado' | 'rechazado') {
    setEnviando(true);
    try {
      await responderPedido(mensaje.id, estado);
      onResponder();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-3 bg-white">
      <p className="text-xs text-neutral-500">
        {mensaje.autorNombre} · pedido de mercadería
      </p>

      <p className="font-medium mt-1">{meta.articuloNombre}</p>

      <div className="flex justify-between text-sm mt-1.5">
        <span className="text-neutral-500">Piden</span>
        <span className="font-mono">{meta.cantidad}</span>
      </div>

      {stockPropio !== null && !propio && (
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Tenés</span>
          <span
            className={`font-mono ${
              stockPropio < (meta.cantidad ?? 0) ? 'text-red-600' : ''
            }`}
          >
            {stockPropio}
          </span>
        </div>
      )}

      {meta.estado === 'pendiente' && !propio && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => void responder('confirmado')}
            disabled={enviando}
            className="flex-1 py-1.5 text-sm bg-neutral-900 text-white rounded disabled:opacity-40"
          >
            Tengo
          </button>
          <button
            onClick={() => void responder('rechazado')}
            disabled={enviando}
            className="flex-1 py-1.5 text-sm border border-neutral-300 rounded disabled:opacity-40"
          >
            No tengo
          </button>
        </div>
      )}

      {meta.estado === 'confirmado' && (
        <p className="text-sm text-emerald-700 mt-2">✓ Confirmado</p>
      )}
      {meta.estado === 'rechazado' && (
        <p className="text-sm text-neutral-500 mt-2">Sin stock</p>
      )}
      {meta.estado === 'pendiente' && propio && (
        <p className="text-sm text-neutral-400 mt-2">Esperando respuesta</p>
      )}
    </div>
  );
}