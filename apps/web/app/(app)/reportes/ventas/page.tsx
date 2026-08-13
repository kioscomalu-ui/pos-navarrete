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

export default async function ReporteVentas({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp.rango, sp.desde, sp.hasta);
  const sesion = await getSesion();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('reporte_ventas_periodo', {
    p_desde: rango.desde,
    p_hasta: rango.hasta,
    p_sucursal_id: sesion.rol === 'admin' ? null : sesion.sucursalId,
  });

  const filas = (data ?? []) as FilaVentas[];

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

  return (
    <div className="space-y-6">
      <SelectorRango />

      {error && <p className="text-sm text-red-600 font-mono">{error.message}</p>}

      <div className="grid grid-cols-5 gap-3">
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

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <table className="w-full text-sm">
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

        {filas.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            No hay ventas en este período
          </p>
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