import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { resolverRango } from '@/lib/rangos-fecha';
import { SelectorRango } from '@/components/reportes/SelectorRango';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface FilaArticulo {
  articulo_id: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  facturado: number;
  costo: number;
  margen: number;
  margen_porcentaje: number;
}

export default async function ReporteArticulos({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp.rango, sp.desde, sp.hasta);
  const sesion = await getSesion();
  const supabase = await createClient();

  const { data } = await supabase.rpc('reporte_articulos_periodo', {
    p_desde: rango.desde,
    p_hasta: rango.hasta,
    p_sucursal_id: sesion.rol === 'admin' ? null : sesion.sucursalId,
    p_limite: 40,
  });

  const filas = (data ?? []) as FilaArticulo[];
  const margenTotal = filas.reduce((a, f) => a + Number(f.margen), 0);

  return (
    <div className="space-y-6">
      <SelectorRango />

      <div className="grid grid-cols-3 gap-3">
        <Tarjeta
          etiqueta="Facturado"
          valor={formatearPrecio(filas.reduce((a, f) => a + Number(f.facturado), 0))}
        />
        <Tarjeta etiqueta="Margen bruto" valor={formatearPrecio(margenTotal)} destacar />
        <Tarjeta etiqueta="Artículos distintos" valor={String(filas.length)} />
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Artículo</th>
              <th className="text-right font-medium px-4 py-2.5">Vendido</th>
              <th className="text-right font-medium px-4 py-2.5">Facturado</th>
              <th className="text-right font-medium px-4 py-2.5">Margen</th>
              <th className="text-right font-medium px-4 py-2.5">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filas.map((f, i) => (
              <tr key={f.articulo_id} className="hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <span className="text-neutral-400 font-mono text-xs mr-2">
                    {i + 1}
                  </span>
                  {f.nombre}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                  {f.unidad === 'unidad'
                    ? Number(f.cantidad)
                    : Number(f.cantidad).toFixed(2)}
                  <span className="text-xs text-neutral-400 ml-1">
                    {f.unidad === 'unidad' ? 'un' : f.unidad}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatearPrecio(Number(f.facturado))}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatearPrecio(Number(f.margen))}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-mono ${
                    Number(f.margen_porcentaje) < 10
                      ? 'text-red-600'
                      : 'text-neutral-500'
                  }`}
                >
                  {Number(f.margen_porcentaje)}%
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
  etiqueta, valor, destacar,
}: { etiqueta: string; valor: string; destacar?: boolean }) {
  return (
    <div className="bg-white border border-neutral-200 rounded p-4">
      <div className="text-xs text-neutral-500">{etiqueta}</div>
      <div className={`font-mono mt-1 ${destacar ? 'text-2xl font-semibold' : 'text-lg'}`}>
        {valor}
      </div>
    </div>
  );
}