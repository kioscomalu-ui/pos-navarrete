'use client';

import { enviarReciboWhatsApp } from '@/lib/cobranza-manager';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { ReciboLocal } from '@/lib/db-local';

interface Props {
  recibo: ReciboLocal;
  empresa: string;
  telefono?: string | null;
  onCerrar: () => void;
}

export function ReciboEmitido({ recibo, empresa, telefono, onCerrar }: Props) {
  return (
    <div className="max-w-sm mx-auto py-12 space-y-6 text-center">
      <div>
        <p className="text-sm text-neutral-500">Pago registrado</p>
        <p className="text-5xl font-mono font-semibold text-emerald-700 mt-1">
          {formatearPrecio(recibo.monto)}
        </p>
        <p className="text-sm text-neutral-500 mt-2">{recibo.clienteNombre}</p>
      </div>

      <div className="bg-white border border-neutral-200 rounded p-5 text-sm space-y-2">
        <Fila etiqueta="Recibo" valor={recibo.numeroRecibo} />
        <Fila etiqueta="Saldo anterior" valor={formatearPrecio(recibo.saldoAnterior)} />
        <Fila etiqueta="Saldo actual" valor={formatearPrecio(recibo.saldoNuevo)} />
      </div>

      <div className="space-y-2">
        <button
          onClick={() => enviarReciboWhatsApp(recibo, empresa, telefono)}
          className="w-full py-3 border border-neutral-300 rounded bg-white"
        >
          Enviar por WhatsApp
        </button>
        <button
          onClick={onCerrar}
          className="w-full py-3 bg-neutral-900 text-white rounded font-medium"
        >
          Siguiente cliente
        </button>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{etiqueta}</span>
      <span className="font-mono">{valor}</span>
    </div>
  );
}