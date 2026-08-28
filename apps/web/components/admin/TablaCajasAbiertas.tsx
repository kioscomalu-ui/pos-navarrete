'use client';

import { useState, useTransition } from 'react';
import { cerrarCajaAdmin, type CajaAbiertaDetalle } from '@/app/(app)/admin/cajas/acciones';
import { formatearPrecio } from '@pos/shared/constants/empresa';

export function TablaCajasAbiertas({ cajas }: { cajas: CajaAbiertaDetalle[] }) {
  if (cajas.length === 0) {
    return (
      <p className="bg-mostrador rounded-lg ring-1 ring-tiza/60 px-4 py-12 text-center text-sm text-verde-claro">
        Todas las cajas están cerradas
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {cajas.map((c) => (
        <FilaCaja key={c.id} caja={c} />
      ))}
    </div>
  );
}

function FilaCaja({ caja }: { caja: CajaAbiertaDetalle }) {
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [pendiente, startTransition] = useTransition();

  const dias = Number(caja.dias_abierta);
  const vieja = dias >= 1;

  return (
    <div
      className={`bg-mostrador rounded-lg ring-1 p-4 ${
        vieja ? 'ring-ambar-dial' : 'ring-tiza/60'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-medium">{caja.vendedor}</div>
          <div className="text-xs text-verde-claro mt-0.5">
            {caja.sucursal} ·{' '}
            {new Date(caja.fecha + 'T12:00').toLocaleDateString('es-AR', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
            })}
            {dias === 0 && ' · hoy'}
            {dias === 1 && ' · ayer'}
            {dias > 1 && (
              <span className="text-ambar-dial font-medium">
                {' '}
                · hace {dias} días
              </span>
            )}
          </div>
        </div>

        {!confirmando && (
          <button
            onClick={() => setConfirmando(true)}
            className="px-3 py-1.5 text-sm rounded ring-1 ring-tiza/60 hover:ring-verde-claro"
          >
            Cerrar caja
          </button>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
        <div>
          <dt className="text-xs text-verde-claro">Fondo inicial</dt>
          <dd className="num">{formatearPrecio(Number(caja.efectivo_inicial))}</dd>
        </div>
        <div>
          <dt className="text-xs text-verde-claro">Ventas en efectivo</dt>
          <dd className="num">{formatearPrecio(Number(caja.ventas_efectivo))}</dd>
        </div>
        <div>
          <dt className="text-xs text-verde-claro">Efectivo esperado</dt>
          <dd className="num font-medium">
            {formatearPrecio(Number(caja.efectivo_esperado))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-verde-claro">Total vendido</dt>
          <dd className="num">{formatearPrecio(Number(caja.total_vendido))}</dd>
        </div>
      </dl>

      {confirmando && (
        <div className="mt-4 pt-4 border-t border-tiza/40 space-y-3">
          <p className="text-xs text-verde-claro">
            Va a quedar cerrada con{' '}
            <span className="num font-medium">
              {formatearPrecio(Number(caja.efectivo_esperado))}
            </span>{' '}
            de efectivo y sin diferencia.
          </p>

          <label className="block">
            <span className="block text-xs text-verde-claro mb-1">
              Motivo (opcional)
            </span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: se fue sin cerrar"
              className="input"
            />
          </label>

          {error && <p className="text-sm text-rojo-plomo">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirmando(false);
                setError('');
              }}
              className="flex-1 py-2 text-sm rounded ring-1 ring-tiza/60"
            >
              Cancelar
            </button>
            <button
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  const r = await cerrarCajaAdmin(caja.id, motivo);
                  if (r.error) setError(r.error);
                })
              }
              className="flex-1 py-2 text-sm rounded bg-verde-esmalte text-white
                         font-medium disabled:opacity-40"
            >
              {pendiente ? 'Cerrando…' : 'Confirmar cierre'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}