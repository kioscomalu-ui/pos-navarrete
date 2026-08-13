'use client';

import { useEffect, useRef } from 'react';

/**
 * Un escáner de códigos de barras se comporta como un teclado que
 * tipea muy rápido y termina con Enter. Se lo distingue de una
 * persona por la velocidad entre teclas.
 */
export function useEscaner(
  onCodigo: (codigo: string) => void,
  activo = true,
) {
  const buffer = useRef('');
  const ultimaTecla = useRef(0);

  useEffect(() => {
    if (!activo) return;

    function onKeyDown(e: KeyboardEvent) {
      // Si el foco está en un input, dejar que el usuario escriba
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const ahora = performance.now();
      if (ahora - ultimaTecla.current > 100) buffer.current = '';
      ultimaTecla.current = ahora;

      if (e.key === 'Enter') {
        if (buffer.current.length >= 6) {
          onCodigo(buffer.current);
          e.preventDefault();
        }
        buffer.current = '';
        return;
      }

      if (e.key.length === 1) buffer.current += e.key;
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCodigo, activo]);
}