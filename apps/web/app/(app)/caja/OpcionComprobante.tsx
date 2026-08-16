'use client';

import { useState } from 'react';

export type TipoSalida = 'nada' | 'remito' | 'factura';

interface Props {
  facturacionActiva: boolean;
  valor: TipoSalida;
  onCambio: (v: TipoSalida) => void;
}

export function OpcionComprobante({
  facturacionActiva,
  valor,
  onCambio,
}: Props) {
  const opciones: { v: TipoSalida; label: string; tecla: string }[] = [
    { v: 'nada', label: 'Sin comprobante', tecla: '1' },
    { v: 'remito', label: 'Remito', tecla: '2' },
    ...(facturacionActiva
      ? [{ v: 'factura' as TipoSalida, label: 'Factura', tecla: '3' }]
      : []),
  ];

  return (
    <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-3">
      <div className="text-[0.65rem] uppercase tracking-wide text-verde-claro mb-2">
        Comprobante
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {opciones.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onCambio(o.v)}
            className={`py-2 rounded text-xs transition ${
              valor === o.v
                ? 'bg-verde-esmalte text-white font-medium'
                : 'ring-1 ring-tiza/60 hover:ring-verde-claro'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}