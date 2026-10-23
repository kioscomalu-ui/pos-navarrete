// ---------------------------------------------------------------------
// ARCHIVO NUEVO
// Guardar en: apps/web/app/(app)/reportes/ventas/dia/[dia]/page.tsx
// (hay que crear las carpetas "dia" y "[dia]")
// ---------------------------------------------------------------------

import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface FilaDetalle {
  venta_id: string;
  fecha: string;
  numero_factura: string;
  vendedor: string | null;
  sucursal: string | null;
  cliente: string | null;
  metodo_pago: string;
  efectivo: number;
  posnet: number;
  billetera: number;
  cuenta_corriente: number;
  total: number;
  costo: number;
  ganancia: number;
}

const ETIQUETA_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  posnet: 'Tarjeta',
  billetera: 'Billetera',
  cuenta_corriente: 'Cta. corriente',
  mixto: 'Combinado',
};

export default async function DetalleDia({
  params,
  searchParams,
}: {
  params: Promise<{ dia: string }>;
  searchParams: Promise<{ vendedor?: string }>;
}) {
  const { dia } = await params;
  const sp = await searchParams;
  const sesion = await getSesion();
  const supabase = await createClient();

  const sucursalFiltro = sesion.rol === 'admin' ? null : sesion.sucursalId;
  const verGanancia = sesion.rol === 'admin';

  const { data, error } = await supabase.rpc('reporte_ventas_detalle_dia', {
    p_dia: dia,
    p_sucursal_id: sucursalFiltro,
    p_vendedor_id: sp.vendedor || null,
  });

  const filas = (data ?? []) as FilaDetalle[];

  const totales = filas.reduce(
    (acc, f) => ({
      total: acc.total + Number(f.total),
      costo: acc.costo + Number(f.costo),
      ganancia: acc.ganancia + Number(f.ganancia),
    }),
    { total: 0, costo: 0, ganancia: 0 },
  );

  const margen = totales.total ? (totales.ganancia / totales.total) * 100 : 0;

  const fechaLegible = new Date(dia + 'T12:00').toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/reportes/ventas"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Volver al reporte de ventas
        </Link>
        <h1 className="text-xl font-semibold mt-1 first-letter:uppercase">
          {fechaLegible}
        </h1>
      </div>

      {error && <p className="text-sm text-red-600 font-mono">{error.message}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tarjeta etiqueta="Ventas" valor={String(filas.length)} />
        <Tarjeta etiqueta="Facturado" valor={formatearPrecio(totales.total)} destacar />
        {verGanancia && (
          <>
            <Tarjeta etiqueta="Costo" valor={formatearPrecio(totales.costo)} />
            <Tarjeta
              etiqueta="Ganancia"
              valor={formatearPrecio(totales.ganancia)}
              nota={`margen ${margen.toFixed(1)}%`}
              destacar
            />
          </>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className={`w-full text-sm ${
              verGanancia ? 'min-w-[52rem]' : 'min-w-[40rem]'
            }`}
          >
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Hora</th>
                <th className="text-left font-medium px-4 py-2.5">Comprobante</th>
                <th className="text-left font-medium px-4 py-2.5">Vendedor</th>
                <th className="text-left font-medium px-4 py-2.5">Cobro</th>
                <th className="text-right font-medium px-4 py-2.5">Total</th>
                {verGanancia && (
                  <>
                    <th className="text-right font-medium px-4 py-2.5">Costo</th>
                    <th className="text-right font-medium px-4 py-2.5">Ganancia</th>
                    <th className="text-right font-medium px-4 py-2.5">Margen</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {filas.map((f) => {
                const total = Number(f.total);
                const ganancia = Number(f.ganancia);
                const margenFila = total ? (ganancia / total) * 100 : 0;

                return (
                  <tr key={f.venta_id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5 font-mono text-neutral-500">
                      {new Date(f.fecha).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs">{f.numero_factura}</div>
                      {f.cliente && (
                        <div className="text-xs text-neutral-400 mt-0.5 truncate max-w-[12rem]">
                          {f.cliente}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="truncate max-w-[10rem]">
                        {f.vendedor ?? '—'}
                      </div>
                      {sesion.rol === 'admin' && f.sucursal && (
                        <div className="text-xs text-neutral-400 mt-0.5 truncate max-w-[10rem]">
                          {f.sucursal}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      <div>{ETIQUETA_PAGO[f.metodo_pago] ?? f.metodo_pago}</div>
                      {f.metodo_pago === 'mixto' && (
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {desglose(f)}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-right font-mono font-medium">
                      {formatearPrecio(total)}
                    </td>

                    {verGanancia && (
                      <>
                        <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                          {formatearPrecio(Number(f.costo))}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono font-medium ${
                            ganancia < 0 ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatearPrecio(ganancia)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono text-xs ${
                            margenFila < 0 ? 'text-red-600' : 'text-neutral-400'
                          }`}
                        >
                          {margenFila.toFixed(1)}%
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>

            {filas.length > 0 && (
              <tfoot className="bg-neutral-50 text-sm font-medium border-t border-neutral-200">
                <tr>
                  <td className="px-4 py-2.5" colSpan={4}>
                    Total del día
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatearPrecio(totales.total)}
                  </td>
                  {verGanancia && (
                    <>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {formatearPrecio(totales.costo)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono ${
                          totales.ganancia < 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatearPrecio(totales.ganancia)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-neutral-400">
                        {margen.toFixed(1)}%
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {filas.length === 0 && !error && (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            No hay ventas registradas ese día
          </p>
        )}
      </div>
    </div>
  );
}

/** Para las ventas combinadas: qué parte se cobró con cada cosa */
function desglose(f: FilaDetalle): string {
  const partes: string[] = [];
  if (Number(f.efectivo) > 0) partes.push(`efectivo ${formatearPrecio(Number(f.efectivo))}`);
  if (Number(f.posnet) > 0) partes.push(`tarjeta ${formatearPrecio(Number(f.posnet))}`);
  if (Number(f.billetera) > 0) partes.push(`billetera ${formatearPrecio(Number(f.billetera))}`);
  if (Number(f.cuenta_corriente) > 0) {
    partes.push(`cta. cte. ${formatearPrecio(Number(f.cuenta_corriente))}`);
  }
  return partes.join(' + ');
}

function Tarjeta({
  etiqueta,
  valor,
  nota,
  destacar,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  destacar?: boolean;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded p-4">
      <div className="text-xs text-neutral-500">{etiqueta}</div>
      <div
        className={`font-mono mt-1 ${destacar ? 'text-2xl font-semibold' : 'text-lg'}`}
      >
        {valor}
      </div>
      {nota && <div className="text-xs text-neutral-400 mt-0.5">{nota}</div>}
    </div>
  );
}