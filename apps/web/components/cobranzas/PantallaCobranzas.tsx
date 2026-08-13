'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  cartera,
  descargarCartera,
  rendicionDelDia,
  type Rendicion,
} from '@/lib/cobranza-manager';
import { pendientes } from '@/lib/cola-sync';
import { formatearPrecio, EMPRESA } from '@pos/shared/constants/empresa';
import type { ClienteLocal, ReciboLocal } from '@/lib/db-local';
import { CobrarCliente } from './CobrarCliente';
import { ReciboEmitido } from './ReciboEmitido';

interface Props {
  cobradorId: string;
  nombreCobrador: string;
  puntoVenta: number;
}

export function PantallaCobranzas({ cobradorId, nombreCobrador, puntoVenta }: Props) {
  const [clientes, setClientes] = useState<ClienteLocal[]>([]);
  const [filtro, setFiltro] = useState('');
  const [cobrando, setCobrando] = useState<ClienteLocal | null>(null);
  const [ultimoRecibo, setUltimoRecibo] = useState<ReciboLocal | null>(null);
  const [rendicion, setRendicion] = useState<Rendicion | null>(null);
  const [enCola, setEnCola] = useState(0);
  const [descargando, setDescargando] = useState(false);
  const [aviso, setAviso] = useState('');

  const refrescar = useCallback(async () => {
    setClientes(await cartera());
    setRendicion(await rendicionDelDia(cobradorId));
    setEnCola(await pendientes());
  }, [cobradorId]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  async function actualizarCartera() {
    setDescargando(true);
    try {
      const n = await descargarCartera(cobradorId);
      setAviso(`${n} clientes en tu cartera`);
      await refrescar();
    } catch {
      setAviso('No se pudo actualizar. Necesitás conexión.');
    } finally {
      setDescargando(false);
      setTimeout(() => setAviso(''), 3000);
    }
  }

  const visibles = filtro
    ? clientes.filter((c) =>
        c.nombre.toLowerCase().includes(filtro.toLowerCase()),
      )
    : clientes;

  const saldoTotal = clientes.reduce((a, c) => a + c.saldo, 0);

  // --- Recibo recién emitido ---
  if (ultimoRecibo) {
    return (
      <ReciboEmitido
        recibo={ultimoRecibo}
        empresa={EMPRESA.razonSocial}
        telefono={clientes.find((c) => c.id === ultimoRecibo.clienteId)?.telefono}
        onCerrar={async () => {
          setUltimoRecibo(null);
          await refrescar();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cobranzas</h1>
          <p className="text-sm text-neutral-500">
            {nombreCobrador} · {clientes.length} clientes
          </p>
        </div>

        <button
          onClick={actualizarCartera}
          disabled={descargando}
          className="px-3 py-2 text-sm border border-neutral-300 rounded hover:bg-neutral-100 disabled:opacity-40"
        >
          {descargando ? 'Descargando…' : 'Actualizar cartera'}
        </button>
      </div>

      {aviso && (
        <p className="text-sm bg-neutral-100 rounded px-4 py-2.5">{aviso}</p>
      )}

      {/* Resumen del día */}
      <div className="grid grid-cols-4 gap-3">
        <Tarjeta
          etiqueta="Cobrado hoy"
          valor={formatearPrecio(rendicion?.total ?? 0)}
          destacar
        />
        <Tarjeta etiqueta="Recibos" valor={String(rendicion?.cantidad ?? 0)} />
        <Tarjeta etiqueta="Por cobrar" valor={formatearPrecio(saldoTotal)} />
        <Tarjeta
          etiqueta="Sin sincronizar"
          valor={String(enCola)}
          alerta={enCola > 0}
        />
      </div>

      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar cliente…"
        className="w-full px-4 py-2.5 border border-neutral-300 rounded"
      />

      {/* Cartera */}
      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <ul className="divide-y divide-neutral-100">
          {visibles.map((c) => {
            const excedido = c.limiteCredito > 0 && c.saldo > c.limiteCredito;

            return (
              <li
                key={c.id}
                onClick={() => setCobrando(c)}
                className="px-4 py-3 hover:bg-neutral-50 cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{c.nombre}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {c.zona && `${c.zona} · `}
                    {c.direccion}
                    {c.ultimoPago && ` · últ. pago ${
                      new Date(c.ultimoPago + 'T12:00').toLocaleDateString('es-AR', {
                        day: '2-digit', month: '2-digit',
                      })
                    }`}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono font-medium ${
                      excedido ? 'text-red-600' : ''
                    }`}
                  >
                    {formatearPrecio(c.saldo)}
                  </div>
                  {excedido && (
                    <div className="text-xs text-red-600">
                      excede el límite
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {visibles.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            {clientes.length === 0
              ? 'Tu cartera está vacía. Tocá "Actualizar cartera" con conexión.'
              : 'Sin resultados'}
          </p>
        )}
      </div>

      {cobrando && (
        <CobrarCliente
          cliente={cobrando}
          cobradorId={cobradorId}
          puntoVenta={puntoVenta}
          onEmitido={(r) => {
            setCobrando(null);
            setUltimoRecibo(r);
          }}
          onCerrar={() => setCobrando(null)}
        />
      )}
    </div>
  );
}

function Tarjeta({
  etiqueta, valor, destacar, alerta,
}: { etiqueta: string; valor: string; destacar?: boolean; alerta?: boolean }) {
  return (
    <div className="bg-white border border-neutral-200 rounded p-4">
      <div className="text-xs text-neutral-500">{etiqueta}</div>
      <div
        className={`font-mono mt-1 ${destacar ? 'text-2xl font-semibold' : 'text-lg'} ${
          alerta ? 'text-amber-700' : ''
        }`}
      >
        {valor}
      </div>
    </div>
  );
}