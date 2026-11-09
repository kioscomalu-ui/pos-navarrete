// ---------------------------------------------------------------------
// ARCHIVO NUEVO
// Guardar en: apps/web/app/(app)/reportes/operadores/page.tsx
// (hay que crear la carpeta "operadores")
// ---------------------------------------------------------------------

import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { resolverRango } from '@/lib/rangos-fecha';
import { SelectorRango } from '@/components/reportes/SelectorRango';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface FilaOperador {
  vendedor_id: string;
  vendedor: string | null;
  sucursales: string;
  cantidad_ventas: number;
  total: number;
  ticket_promedio: number;
  efectivo: number;
  posnet: number;
  billetera: number;
  cuenta_corriente: number;
  costo: number;
  ganancia: number;
}

export default async function ReporteOperadores({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp.rango, sp.desde, sp.hasta);
  const sesion = await getSesion();
  const supabase = await createClient();

  const sucursalFiltro = sesion.rol === 'admin' ? null : sesion.sucursalId;
  const verGanancia = sesion.rol === 'admin';

  const { data, error } = await supabase.rpc('reporte_ventas_por_operador', {
    p_desde: rango.desde,
    p_hasta: rango.hasta,
    p_sucursal_id: sucursalFiltro,
  });

  const filas = (data ?? []) as FilaOperador[];

  const totales = filas.reduce(
    (acc, f) => ({
      ventas: acc.ventas + Number(f.cantidad_ventas),
      total: acc.total + Number(f.total),
      efectivo: acc.efectivo + Number(f.efectivo),
      posnet: acc.posnet + Number(f.posnet),
      billetera: acc.billetera + Number(f.billetera),
      cuentaCorriente: acc.cuentaCorriente + Number(f.cuenta_corriente),
      ganancia: acc.ganancia + Number(f.ganancia),
    }),
    {
      ventas: 0,
      total: 0,
      efectivo: 0,
      posnet: 0,
      billetera: 0,
      cuentaCorriente: 0,
      ganancia: 0,
    },
  );

  const maximo = Math.max(...filas.map((f) => Number(f.total)), 1);

  function urlVentasDe(id: string): string {
    const params = new URLSearchParams();
    if (sp.rango) params.set('rango', sp.rango);
    if (sp.desde) params.set('desde', sp.desde);
    if (sp.hasta) params.set('hasta', sp.hasta);
    params.set('vendedor', id);
    return `/reportes/ventas?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <SelectorRango />

      {error && <p className="text-sm text-red-600 font-mono">{error.message}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tarjeta etiqueta="Operadores" valor={String(filas.length)} />
        <Tarjeta etiqueta="Ventas" valor={String(totales.ventas)} />
        <Tarjeta etiqueta="Facturado" valor={formatearPrecio(totales.total)} destacar />
        {verGanancia && (
          <Tarjeta
            etiqueta="Ganancia"
            valor={formatearPrecio(totales.ganancia)}
            nota={
              totales.total
                ? `margen ${((totales.ganancia / totales.total) * 100).toFixed(1)}%`
                : undefined
            }
            destacar
          />
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className={`w-full text-sm ${
              verGanancia ? 'min-w-[58rem]' : 'min-w-[48rem]'
            }`}
          >
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Operador</th>
                <th className="text-right font-medium px-4 py-2.5">Ventas</th>
                <th className="text-right font-medium px-4 py-2.5">Ticket prom.</th>
                <th className="text-right font-medium px-4 py-2.5">Efectivo</th>
                <th className="text-right font-medium px-4 py-2.5">POSNET</th>
                <th className="text-right font-medium px-4 py-2.5">Billetera</th>
                <th className="text-right font-medium px-4 py-2.5">Cta. corriente</th>
                <th className="text-right font-medium px-4 py-2.5">Total</th>
                {verGanancia && (
                  <>
                    <th className="text-right font-medium px-4 py-2.5">Ganancia</th>
                    <th className="text-right font-medium px-4 py-2.5">Margen</th>
                  </>
                )}
                <th className="w-24 px-4 py-2.5"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {filas.map((f) => {
                const total = Number(f.total);
                const ganancia = Number(f.ganancia);
                const margenFila = total ? (ganancia / total) * 100 : 0;

                return (
                  <tr key={f.vendedor_id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={urlVentasDe(f.vendedor_id)}
                        className="font-medium hover:underline underline-offset-2"
                      >
                        {f.vendedor ?? 'Sin nombre'}
                      </Link>
                      {f.sucursales && (
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {f.sucursales}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {f.cantidad_ventas}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {formatearPrecio(Number(f.ticket_promedio))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {formatearPrecio(Number(f.efectivo))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {formatearPrecio(Number(f.posnet))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {formatearPrecio(Number(f.billetera))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {formatearPrecio(Number(f.cuenta_corriente))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">
                      {formatearPrecio(total)}
                    </td>

                    {verGanancia && (
                      <>
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

                    <td className="px-4 py-2.5">
                      <div className="h-1.5 bg-neutral-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-neutral-900"
                          style={{ width: `${(total / maximo) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {filas.length > 0 && (
              <tfoot className="bg-neutral-50 text-sm font-medium border-t border-neutral-200">
                <tr>
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono">{totales.ventas}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatearPrecio(
                      totales.ventas ? totales.total / totales.ventas : 0,
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatearPrecio(totales.efectivo)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatearPrecio(totales.posnet)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatearPrecio(totales.billetera)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatearPrecio(totales.cuentaCorriente)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatearPrecio(totales.total)}
                  </td>
                  {verGanancia && (
                    <>
                      <td
                        className={`px-4 py-2.5 text-right font-mono ${
                          totales.ganancia < 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatearPrecio(totales.ganancia)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-neutral-400">
                        {totales.total
                          ? ((totales.ganancia / totales.total) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {filas.length === 0 && !error && (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            No hay ventas en este período
          </p>
        )}
      </div>

      <p className="text-xs text-neutral-400">
        El operador es el usuario que tenía la sesión abierta cuando se registró
        la venta. Hacé clic en un nombre para ver sus ventas día por día.
      </p>
    </div>
  );
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