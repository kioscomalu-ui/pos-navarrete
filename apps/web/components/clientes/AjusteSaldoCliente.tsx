'use client';

import { useState, useTransition } from 'react';
import { ajustarSaldoCliente } from '@/app/(app)/clientes/acciones';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Props {
  clienteId: string;
  saldoActual: number;
}

export function AjusteSaldoCliente({ clienteId, saldoActual }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [saldo, setSaldo] = useState(String(saldoActual));
  const [motivo, setMotivo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [pendiente, startTransition] = useTransition();

  const nuevo = Number(saldo.replace(',', '.'));
  const valido =
    Number.isFinite(nuevo) && nuevo >= 0 && motivo.trim().length >= 5;
  const diferencia = Number.isFinite(nuevo) ? nuevo - saldoActual : 0;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-verde-claro hover:text-verde-esmalte"
      >
        Ajustar saldo
      </button>
    );
  }

  return (
    <div className="bg-ambar-suave border-l-4 border-ambar-dial rounded-r p-4 space-y-3 max-w-lg">
      <div>
        <h3 className="text-sm font-medium">Ajustar saldo</h3>
        <p className="text-xs text-verde-claro mt-0.5">
          Solo para corregir una deuda anterior al sistema o un error de
          carga. Las ventas y los cobros ya mueven el saldo solos.
        </p>
      </div>

      <label className="block">
        <span className="block text-xs text-verde-claro mb-1">
          Saldo correcto
        </span>
        <input
          value={saldo}
          onChange={(e) => {
            setSaldo(e.target.value);
            setMensaje('');
          }}
          inputMode="decimal"
          autoFocus
          className="input num text-right"
        />
        <span className="block text-xs text-verde-claro/70 mt-1">
          Actual {formatearPrecio(saldoActual)}
          {Number.isFinite(nuevo) && diferencia !== 0 && (
            <>
              {' · '}
              {diferencia > 0 ? 'aumenta' : 'baja'}{' '}
              {formatearPrecio(Math.abs(diferencia))}
            </>
          )}
        </span>
      </label>

      <label className="block">
        <span className="block text-xs text-verde-claro mb-1">Motivo</span>
        <input
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setMensaje('');
          }}
          placeholder="Ej: deuda del cuaderno anterior al sistema"
          className="input"
        />
      </label>

      {mensaje && <p className="text-sm text-rojo-plomo">{mensaje}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setMensaje('');
            setSaldo(String(saldoActual));
            setMotivo('');
          }}
          className="flex-1 py-2 text-xs rounded ring-1 ring-tiza"
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={!valido || pendiente}
          onClick={() =>
            startTransition(async () => {
              const r = await ajustarSaldoCliente(clienteId, nuevo, motivo);
              if (r.error) {
                setMensaje(r.error);
              } else {
                setAbierto(false);
                setMotivo('');
              }
            })
          }
          className="flex-1 py-2 text-xs rounded bg-verde-esmalte text-white
                     disabled:opacity-30"
        >
          {pendiente ? 'Guardando…' : 'Ajustar saldo'}
        </button>
      </div>

      <p className="text-xs text-verde-claro/70">
        Queda registrado con tu nombre, la fecha y el motivo.
      </p>
    </div>
  );
}