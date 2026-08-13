'use client';

import { useEffect, useRef, useState } from 'react';
import { catalogo } from '@/lib/catalogo-cache';
import { formatearPrecio } from '@pos/shared/constants/empresa';

export function BuscadorArticulos({
  onElegir, onCerrar,
}: { onElegir: (id: string) => void; onCerrar: () => void }) {
  const [termino, setTermino] = useState('');
  const [seleccion, setSeleccion] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const resultados = catalogo.buscar(termino);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setSeleccion(0); }, [termino]);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center pt-32 z-50"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={input}
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSeleccion((s) => Math.min(s + 1, resultados.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSeleccion((s) => Math.max(s - 1, 0));
            }
            if (e.key === 'Enter' && resultados[seleccion]) {
              e.preventDefault();
              onElegir(resultados[seleccion].id);
            }
            if (e.key === 'Escape') onCerrar();
          }}
          placeholder="Buscar artículo…"
          className="w-full px-5 py-4 text-lg outline-none border-b border-neutral-200"
        />

        <ul className="max-h-80 overflow-y-auto">
          {resultados.map((a, i) => (
            <li
              key={a.id}
              onMouseEnter={() => setSeleccion(i)}
              onClick={() => onElegir(a.id)}
              className={`px-5 py-2.5 flex justify-between cursor-pointer ${
                i === seleccion ? 'bg-neutral-100' : ''
              }`}
            >
              <span>
                {a.nombre}
                <span className="text-xs text-neutral-400 ml-2">
                  stock {catalogo.stockDe(a.id)}
                </span>
              </span>
              <span className="font-mono">{formatearPrecio(a.precioVentaFinal)}</span>
            </li>
          ))}

          {termino.length >= 2 && resultados.length === 0 && (
            <li className="px-5 py-8 text-center text-neutral-400 text-sm">
              Sin resultados
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}