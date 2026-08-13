'use client';

import { useEffect, useRef, useState } from 'react';
import { buscarEnCartera } from '@/lib/cobranza-manager';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { ClienteLocal } from '@/lib/db-local';

interface Props {
  total: number;
  onElegir: (cliente: ClienteLocal) => void;
  onCerrar: () => void;
}

export function SelectorCliente({ total, onElegir, onCerrar }: Props) {
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState<ClienteLocal[]>([]);
  const [seleccion, setSeleccion] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    setSeleccion(0);
    void buscarEnCartera(termino).then(setResultados);
  }, [termino]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 z-50"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-neutral-200 flex justify-between items-baseline">
          <span className="text-sm text-neutral-500">
            Cargar a cuenta corriente
          </span>
          <span className="font-mono font-semibold">
            {formatearPrecio(total)}
          </span>
        </div>

        <input
          ref={input}
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
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
              onElegir(resultados[seleccion]);
            }
            if (e.key === 'Escape') onCerrar();
          }}
          placeholder="Buscar cliente…"
          className="w-full px-5 py-4 text-lg outline-none border-b border-neutral-200"
        />

        <ul className="max-h-72 overflow-y-auto">
          {resultados.map((c, i) => {
            const nuevoSaldo = c.saldo + total;
            const excede = c.limiteCredito > 0 && nuevoSaldo > c.limiteCredito;

            return (
              <li
                key={c.id}
                onMouseEnter={() => setSeleccion(i)}
                onClick={() => onElegir(c)}
                className={`px-5 py-3 flex justify-between cursor-pointer ${
                  i === seleccion ? 'bg-neutral-100' : ''
                }`}
              >
                <div>
                  <div>{c.nombre}</div>
                  {excede && (
                    <div className="text-xs text-red-600 mt-0.5">
                      supera el límite de {formatearPrecio(c.limiteCredito)}
                    </div>
                  )}
                </div>
                <div className="text-right font-mono text-sm">
                  <div className="text-neutral-500">
                    {formatearPrecio(c.saldo)}
                  </div>
                  <div className={excede ? 'text-red-600' : 'text-neutral-400'}>
                    → {formatearPrecio(nuevoSaldo)}
                  </div>
                </div>
              </li>
            );
          })}

          {termino.length >= 2 && resultados.length === 0 && (
            <li className="px-5 py-8 text-center text-neutral-400 text-sm">
              Sin resultados. La cartera se descarga desde Cobranzas.
            </li>
          )}

          {termino.length < 2 && (
            <li className="px-5 py-8 text-center text-neutral-400 text-sm">
              Escribí al menos dos letras
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}