import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { resolverRango } from '@/lib/rangos-fecha';
import { SelectorRango } from '@/components/reportes/SelectorRango';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface FilaVentas {
  dia: string;
  cantidad_ventas: number;
  total: number;
  ticket_promedio: number;
  efectivo: number;
  posnet: number;
  billetera: number;
}

interface FilaRanking {
  vendedor_id: string;
  vendedor: string;
  cantidad: number;
  total: number;
}

export default async function ReporteVentas({
  searchParams,
}: {
  searchParams: Promise<{
    rango?: string;
    desde?: string;
    hasta?: string;
    vendedor?: string;
  }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp.rango, sp.desde, sp.hasta);
  const sesion = await getSesion();
  const supabase = await createClient();

  const sucursalFiltro = sesion.rol === 'admin' ? null : sesion.sucursalId;
  const vendedorSeleccionado = sp.vendedor ?? '';

  const [{ data, error }, { data: ranking }] = await Promise.all([
    supabase.rpc('reporte_ventas_periodo', {
      p_desde: rango.desde,
      p_hasta: rango.hasta,
      p_sucursal_id: sucursalFiltro,
      p_vendedor_id: vendedorSeleccionado || null,
    }),
    supabase.rpc('ranking_vendedores_periodo', {
      p_desde: rango.desde,
      p_hasta: rango.hasta,
      p_sucursal_id: sucursalFiltro,
    }),
  ]);

  const filas = (data ?? []) as FilaVentas[];
  const filasRanking = (ranking ?? []) as FilaRanking[];

  const totales = filas.reduce(
    (acc, f) => ({
      ventas: acc.ventas + Number(f.cantidad_ventas),
      total: acc.total + Number(f.total),
      efectivo: acc.efectivo + Number(f.efectivo),
      posnet: acc.posnet + Number(f.posnet),
      billetera: acc.billetera + Number(f.billetera),
    }),
    { ventas: 0, total: 0, efectivo: 0, posnet: 0, billetera: 0 },
  );

  const maximo = Math.max(...filas.map((f) => Number(f.total)), 1);
  const maximoRanking = Math.max(...filasRanking.map((f) => Number(f.total)), 1);

  function urlConVendedor(id: string): string {
    const params = new URLSearchParams();
    if (sp.rango) params.set('rango', sp.rango);
    if (sp.desde) params.set('desde', sp.desde);
    if (sp.hasta) params.set('hasta', sp.hasta);
    if (id) params.set('vendedor', id);
    const qs = params.toString();
    return qs ? `/reportes/ventas?${qs}` : '/reportes/ventas';
  }

  return (
    <div className="space-y-6">
      <SelectorRango />

      {error && <p className="text-sm text-red-600 font-mono">{error.message}</p>}

      {filasRanking.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={urlConVendedor('')}
            className={`px-3 py-1.5 text-xs rounded-full ${
              !vendedorSeleccionado
                ? 'bg-neutral-900 text-white'
                : 'bg-white ring-1 ring-neutral-200 text-neutral-600'
            }`}
          >
            Todos
          </Link>
          {filasRanking.map((r) => (
            <Link
              key={r.vendedor_id}
              href={urlConVendedor(r.vendedor_id)}
              className={`px-3 py-1.5 text-xs rounded-full ${
                vendedorSeleccionado === r.vendedor_id
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white ring-1 ring-neutral-200 text-neutral-600'
              }`}
            >
              {r.vendedor}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Tarjeta etiqueta="Facturado" valor={formatearPrecio(totales.total)} destacar />
        <Tarjeta etiqueta="Ventas" valor={String(totales.ventas)} />
        <Tarjeta
          etiqueta="Ticket promedio"
          valor={formatearPrecio(totales.ventas ? totales.total / totales.ventas : 0)}
        />
        <Tarjeta etiqueta="Efectivo" valor={formatearPrecio(totales.efectivo)} />
        <Tarjeta
          etiqueta="Tarjeta + billetera"
          valor={formatearPrecio(totales.posnet + totales.billetera)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4">
        <div className="bg-white border border-neutral-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[38rem]">
              <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Día</th>
                  <th className="text-right font-medium px-4 py-2.5">Ventas</th>
                  <th className="text-right font-medium px-4 py-2.5">Efectivo</th>
                  <th className="text-right font-medium px-4 py-2.5">POSNET</th>
                  <th className="text-right font-medium px-4 py-2.5">Billetera</th>
                  <th className="text-right font-medium px-4 py-2.5">Total</th>
                  <th className="w-32 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filas.map((f) => (
                  <tr key={f.dia} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      {new Date(f.dia + 'T12:00').toLocaleDateString('es-AR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {f.cantidad_ventas}
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
                    <td className="px-4 py-2.5 text-right font-mono font-medium">
                      {formatearPrecio(Number(f.total))}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-1.5 bg-neutral-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-neutral-900"
                          style={{ width: `${(Number(f.total) / maximo) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filas.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-neutral-400">
              No hay ventas en este período
            </p>
          )}
        </div>

        {filasRanking.length > 0 && (
          <div className="bg-white border border-neutral-200 rounded overflow-hidden h-fit">
            <div className="px-4 py-2.5 bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
              Por vendedor
            </div>
            <div className="divide-y divide-neutral-100">
              {filasRanking.map((r) => (
                <Link
                  key={r.vendedor_id}
                  href={urlConVendedor(
                    vendedorSeleccionado === r.vendedor_id ? '' : r.vendedor_id,
                  )}
                  className={`block px-4 py-2.5 hover:bg-neutral-50 ${
                    vendedorSeleccionado === r.vendedor_id ? 'bg-neutral-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{r.vendedor}</span>
                    <span className="font-mono font-medium ml-2 shrink-0">
                      {formatearPrecio(Number(r.total))}
                    </span>
                  </div>
                  <div className="h-1 bg-neutral-100 rounded overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-neutral-400"
                      style={{ width: `${(Number(r.total) / maximoRanking) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    {r.cantidad} {Number(r.cantidad) === 1 ? 'venta' : 'ventas'}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  destacar,
}: {
  etiqueta: string;
  valor: string;
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
    </div>
  );
}