'use client';

import { useEffect, useState } from 'react';
import Decimal from 'decimal.js';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import { totalesDelDia, type TotalesDia } from '@/lib/caja-manager';
import type { CajaLocal } from '@/lib/db-local';

interface Props {
  caja: CajaLocal;
  umbralDiferencia: number;
  onCerrar: (d: {
    efectivoFinal: number;
    billeteraFinal: number;
    posnetFinal: number;
    notas: string;
  }) => void;
  onVolver: () => void;
  cargando: boolean;
}

export function CierreCaja({ caja, umbralDiferencia, onCerrar, onVolver, cargando }: Props) {
  const [totales, setTotales] = useState<TotalesDia | null>(null);
  const [errorTotales, setErrorTotales] = useState('');
  const [declarado, setDeclarado] = useState(false);

  const [efectivo, setEfectivo] = useState('');
  const [billetera, setBilletera] = useState('');
  const [posnet, setPosnet] = useState('');
  const [notas, setNotas] = useState('');

  function cargarTotales() {
    setErrorTotales('');
    setTotales(null);
    totalesDelDia(caja)
      .then(setTotales)
      .catch((e) => {
        setErrorTotales(
          e instanceof Error ? e.message : 'No se pudieron calcular los totales',
        );
      });
  }

  useEffect(() => {
    cargarTotales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caja]);

  if (errorTotales) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <p className="text-sm text-red-700">{errorTotales}</p>
        <button
          onClick={cargarTotales}
          className="px-4 py-2 bg-neutral-900 text-white rounded text-sm"
        >
          Reintentar
        </button>
        <button
          onClick={onVolver}
          className="block w-full py-2 text-sm text-neutral-500 hover:text-neutral-900"
        >
          Volver a la caja
        </button>
      </div>
    );
  }

  if (!totales) {
    return <p className="py-16 text-center text-neutral-500">Calculando…</p>;
  }

  const nEfectivo = Number(efectivo.replace(',', '.')) || 0;
  const nBilletera = Number(billetera.replace(',', '.')) || 0;
  const nPosnet = Number(posnet.replace(',', '.')) || 0;

  const diferencia = new Decimal(nEfectivo)
    .minus(totales.efectivoEsperado)
    .toDecimalPlaces(2)
    .toNumber();

  const difBilletera = new Decimal(nBilletera).minus(totales.billetera).toNumber();
  const difPosnet = new Decimal(nPosnet).minus(totales.posnet).toNumber();

  const requiereNota = Math.abs(diferencia) > umbralDiferencia;
  const puedeCerrar = declarado && (!requiereNota || notas.trim().length >= 5);

  // El detalle de cómo se compone el esperado: si hubo pagos a
  // proveedor, retiros o transferencias, tienen que verse acá o la
  // persona no entiende de dónde sale el número.
  const detalleEfectivo =
    `Inicial ${formatearPrecio(caja.efectivoInicial)}` +
    ` + ventas ${formatearPrecio(totales.efectivo)}` +
    (totales.ingresos > 0
      ? ` + recibido ${formatearPrecio(totales.ingresos)}`
      : '') +
    (totales.egresos > 0 ? ` − salidas ${formatearPrecio(totales.egresos)}` : '');

  return (
    <div className="max-w-lg mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cierre de caja</h1>
        <p className="text-sm text-neutral-500">
          {totales.cantidadVentas} ventas · {formatearPrecio(totales.total)} facturado
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded p-6 space-y-4">
        <div>
          <h2 className="text-sm font-medium">Contá y declará lo que tenés</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Los totales del sistema aparecen después de declarar.
          </p>
        </div>

        <CampoMonto
          label="Efectivo en caja"
          valor={efectivo}
          onChange={setEfectivo}
          disabled={declarado}
          autoFocus
        />
        <CampoMonto
          label="Total en billetera virtual"
          valor={billetera}
          onChange={setBilletera}
          disabled={declarado}
        />
        <CampoMonto
          label="Total en POSNET"
          valor={posnet}
          onChange={setPosnet}
          disabled={declarado}
        />

        {!declarado && (
          <button
            onClick={() => setDeclarado(true)}
            className="w-full py-2.5 bg-neutral-900 text-white rounded font-medium disabled:opacity-30"
          >
            Confirmar declaración
          </button>
        )}
      </div>

      {declarado && (
        <>
          <div className="bg-white border border-neutral-200 rounded p-6 space-y-3">
            <h2 className="text-sm font-medium">Comparación</h2>

            <Comparacion
              etiqueta="Efectivo"
              declarado={nEfectivo}
              esperado={totales.efectivoEsperado}
              diferencia={diferencia}
              detalle={detalleEfectivo}
            />
            <Comparacion
              etiqueta="Billetera"
              declarado={nBilletera}
              esperado={totales.billetera}
              diferencia={difBilletera}
            />
            <Comparacion
              etiqueta="POSNET"
              declarado={nPosnet}
              esperado={totales.posnet}
              diferencia={difPosnet}
            />
          </div>

          {requiereNota && (
            <div className="bg-amber-50 border border-amber-200 rounded p-4 space-y-2">
              <p className="text-sm text-amber-900">
                La diferencia supera {formatearPrecio(umbralDiferencia)}.
              </p>

              {diferencia < 0 && (
                <div className="text-sm text-amber-900 space-y-1">
                  <p className="font-medium">Antes de cerrar, fijate:</p>
                  <ul className="list-disc pl-5 space-y-0.5 text-xs">
                    <li>¿Pagaste algo con plata de la caja?</li>
                    <li>¿Entregaste efectivo a alguien o lo guardaste?</li>
                  </ul>
                  <p className="text-xs">
                    Si fue así, volvé a la caja y registralo con{' '}
                    <strong>Retirar</strong> o <strong>Pagar proveedor</strong>.
                    Así el arqueo cierra solo y no queda como faltante.
                  </p>
                </div>
              )}

              <p className="text-sm text-amber-900">
                Explicá brevemente qué pasó.
              </p>

              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Ej: se pagó un flete de $2.000 con dinero de la caja"
                className="w-full px-3 py-2 border border-amber-300 rounded text-sm"
              />
            </div>
          )}

          {!requiereNota && (
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Notas (opcional)"
              className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setDeclarado(false)}
              className="flex-1 py-2.5 border border-neutral-300 rounded"
            >
              Corregir
            </button>
            <button
              onClick={() =>
                onCerrar({
                  efectivoFinal: nEfectivo,
                  billeteraFinal: nBilletera,
                  posnetFinal: nPosnet,
                  notas,
                })
              }
              disabled={!puedeCerrar || cargando}
              className="flex-1 py-2.5 bg-neutral-900 text-white rounded font-medium disabled:opacity-30"
            >
              {cargando ? 'Cerrando…' : 'Cerrar caja'}
            </button>
          </div>
        </>
      )}

      <button
        onClick={onVolver}
        className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-900"
      >
        Volver a la caja
      </button>
    </div>
  );
}

function CampoMonto({
  label, valor, onChange, disabled, autoFocus,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  disabled: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{label}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        inputMode="decimal"
        placeholder="0,00"
        className="w-full px-3 py-2 text-lg font-mono text-right border
                   border-neutral-300 rounded focus:outline-none focus:border-neutral-900
                   disabled:bg-neutral-50 disabled:text-neutral-500"
      />
    </label>
  );
}

function Comparacion({
  etiqueta, declarado, esperado, diferencia, detalle,
}: {
  etiqueta: string;
  declarado: number;
  esperado: number;
  diferencia: number;
  detalle?: string;
}) {
  const color =
    diferencia === 0
      ? 'text-neutral-500'
      : diferencia > 0
        ? 'text-blue-700'
        : 'text-red-700';

  return (
    <div className="border-t border-neutral-100 pt-2.5 first:border-0 first:pt-0">
      <div className="flex justify-between text-sm">
        <span>{etiqueta}</span>
        <span className={`font-mono ${color}`}>
          {diferencia > 0 && '+'}
          {formatearPrecio(diferencia)}
        </span>
      </div>
      <div className="flex justify-between text-xs text-neutral-500 font-mono mt-0.5">
        <span>declarado {formatearPrecio(declarado)}</span>
        <span>sistema {formatearPrecio(esperado)}</span>
      </div>
      {detalle && (
        <p className="text-xs text-neutral-400 mt-0.5">{detalle}</p>
      )}
    </div>
  );
}