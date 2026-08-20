'use client';

import { useEffect, useRef, useState } from 'react';
import { TarjetaPedidoStock } from './TarjetaPedidoStock';
import type { useChat } from '@/hooks/useChat';
import type { ContextoChat } from '@/lib/chat-manager';

interface Props {
  chat: ReturnType<typeof useChat>;
  ctx: ContextoChat;
  abierto: boolean;
  onCerrar: () => void;
}

export function PanelChat({ chat, ctx, abierto, onCerrar }: Props) {
  const { canales, canalActivo, mensajes, noLeidos, enviar, abrirCanal, refrescar } =
    chat;

  const [texto, setTexto] = useState('');
  const finLista = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    finLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length]);

  useEffect(() => {
    if (abierto) input.current?.focus();
  }, [abierto, canalActivo]);

  if (!abierto) return null;

  const canal = canales.find((c) => c.id === canalActivo);
  const puedeEscribir = canal && !canal.soloLectura;
  const esCanalCompras = canal?.nombre === 'Compras';

  async function mandar() {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    await enviar(t);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onCerrar} />

      <aside
        className="fixed inset-x-0 bottom-0 top-14 sm:inset-x-auto sm:right-0
                   sm:top-0 sm:bottom-0 sm:w-96 bg-white sm:border-l
                   border-neutral-200 z-50 flex flex-col shadow-xl"
      >
        <div className="border-b border-neutral-200">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-medium">Mensajes</span>
            <button
              onClick={onCerrar}
              className="text-neutral-400 hover:text-neutral-900 text-xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="flex gap-1 px-2 pb-2 overflow-x-auto">
            {canales.map((c) => {
              const n = noLeidos.get(c.id) ?? 0;
              const activo = c.id === canalActivo;

              return (
                <button
                  key={c.id}
                  onClick={() => void abrirCanal(c.id)}
                  className={`px-3 py-1.5 text-sm rounded whitespace-nowrap flex items-center gap-1.5 ${
                    activo
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {c.nombre}
                  {n > 0 && !activo && (
                    <span className="bg-neutral-900 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {n > 9 ? '9+' : n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {mensajes.length === 0 && (
            <p className="text-center text-sm text-neutral-400 py-12">
              No hay mensajes todavía
            </p>
          )}

          {mensajes.map((m) => {
            const propio = m.autorId === ctx.usuarioId;

            if (m.tipo === 'pedido_stock') {
              return (
                <TarjetaPedidoStock
                  key={m.id}
                  mensaje={m}
                  propio={propio}
                  esCompras={esCanalCompras}
                  onResponder={refrescar}
                />
              );
            }

            if (m.tipo === 'aviso') {
              return (
                <div
                  key={m.id}
                  className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm"
                >
                  <p className="text-xs text-amber-700 mb-0.5">
                    {m.autorNombre} · aviso
                  </p>
                  {m.contenido}
                </div>
              );
            }

            return (
              <div key={m.id} className={propio ? 'text-right' : ''}>
                {!propio && (
                  <p className="text-xs text-neutral-500 mb-0.5">{m.autorNombre}</p>
                )}
                <div
                  className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[85%] text-left ${
                    propio
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100'
                  }`}
                >
                  {m.contenido}
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {new Date(m.createdAt).toLocaleTimeString('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {m.estadoLocal === 'pendiente' && ' · enviando'}
                </p>
              </div>
            );
          })}

          <div ref={finLista} />
        </div>

        {puedeEscribir ? (
          <div className="border-t border-neutral-200 p-3 flex gap-2">
            <input
              ref={input}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void mandar();
                }
                e.stopPropagation();
              }}
              placeholder="Escribí un mensaje…"
              className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm"
            />
            <button
              onClick={() => void mandar()}
              disabled={!texto.trim()}
              className="px-4 py-2 bg-neutral-900 text-white rounded text-sm disabled:opacity-30"
            >
              Enviar
            </button>
          </div>
        ) : (
          <p className="border-t border-neutral-200 p-3 text-center text-xs text-neutral-400">
            Canal de solo lectura
          </p>
        )}
      </aside>
    </>
  );
}