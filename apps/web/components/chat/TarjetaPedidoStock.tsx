'use client';

import { useState } from 'react';
import { responderPedido } from '@/lib/chat-manager';
import { catalogo } from '@/lib/catalogo-cache';
import type { MensajeLocal } from '@/lib/db-local';

interface Props {
  mensaje: MensajeLocal;
  propio: boolean;
  /** true cuando el pedido cayó en el canal "Compras", no en uno de sucursal */
  esCompras: boolean;
  onResponder: () => void;
}

export function TarjetaPedidoStock({ mensaje, propio, esCompras, onResponder }: Props) {
  const [enviando, setEnviando] = useState(false);

  const meta = (mensaje.metadata ?? {}) as {
    articuloId?: string;
    articuloNombre?: string;
    cantidad?: number;
    estado?: string;
  };

  // La comparación contra stock propio solo tiene sentido cuando el
  // pedido es entre sucursales ("¿vos tenés esto para pasarme?"). En
  // Compras, quien lee no está resolviendo con SU stock, va a salir
  // a comprarlo — mostrar "Tenés: X" ahí sería confuso.
  const stockPropio =
    !esCompras && meta.articuloId ? catalogo.stockDe(meta.articuloId) : null;

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
        {mensaje.autorNombre} · {esCompras ? 'pedido a compras' : 'pedido de mercadería'}
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
            {esCompras ? 'Comprado' : 'Tengo'}
          </button>
          <button
            onClick={() => void responder('rechazado')}
            disabled={enviando}
            className="flex-1 py-1.5 text-sm border border-neutral-300 rounded disabled:opacity-40"
          >
            {esCompras ? 'No se consigue' : 'No tengo'}
          </button>
        </div>
      )}

      {meta.estado === 'confirmado' && (
        <p className="text-sm text-emerald-700 mt-2">
          ✓ {esCompras ? 'Comprado' : 'Confirmado'}
        </p>
      )}

      {meta.estado === 'rechazado' && (
        <p className="text-sm text-neutral-500 mt-2">
          {esCompras ? 'No se consigue' : 'Sin stock'}
        </p>
      )}

      {meta.estado === 'pendiente' && propio && (
        <p className="text-sm text-neutral-400 mt-2">Esperando respuesta</p>
      )}
    </div>
  );
}