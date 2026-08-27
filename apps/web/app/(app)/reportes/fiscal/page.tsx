import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { resolverRango } from '@/lib/rangos-fecha';
import { SelectorRango } from '@/components/reportes/SelectorRango';
import { AccionesFiscal } from '@/components/reportes/AccionesFiscal';
import { formatearPrecio } from '@pos/shared/constants/empresa';

export interface FilaFiscal {
  dia: string;
  sucursal: string;
  sucursal_codigo: string;
  punto_venta: number;
  metodo: string;
  cantidad_ventas: number;
  total: number;
  neto_21: number;
  iva_21: number;
  neto_105: number;
  iva_105: number;
  neto_exento: number;
}

const ETIQUETA_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  posnet: 'Tarjeta',
  billetera: 'Billetera',
  cuenta_corriente: 'Cta. corriente',
};

export default async function ReporteFiscal({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp.rango, sp.desde, sp.hasta);
  const sesion = await getSesion();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('reporte_fiscal_periodo', {
    p_desde: rango.desde,
    p_hasta: rango.hasta,
  });

  const filas = (data ?? []) as FilaFiscal[];

  const totales = filas.reduce(
    (a, f) => ({
      total: a.total + Number(f.total),
      neto21: a.neto21 + Number(f.neto_21),
      iva21: a.iva21 + Number(f.iva_21),
      neto105: a.neto105 + Number(f.neto_105),
      iva105: a.iva105 + Number(f.iva_105),
    }),
    { total: 0, neto21: 0, iva21: 0, neto105: 0, iva105: 0 },
  );

  return (
    <div className="space-y-6">
      <SelectorRango />

      <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r px-4 py-3">
        <p className="text-sm">
          Cada fila de esta tabla es <strong>un comprobante</strong> a cargar en
          Comprobantes en Línea de ARCA.
        </p>
        <p className="text-xs text-neutral-600 mt-1">
          Factura B a Consumidor Final, con el punto de venta de la sucursal que
          corresponde. Los netos y el IVA salen de la alícuota cargada en cada
          artículo vendido.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 font-mono">{error.message}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tarjeta etiqueta="Total del período" valor={formatearPrecio(totales.total)} destacar />
        <Tarjeta etiqueta="Comprobantes" valor={String(filas.length)} />
        <Tarjeta etiqueta="IVA 21%" valor={formatearPrecio(totales.iva21)} />
        <Tarjeta etiqueta="IVA 10,5%" valor={formatearPrecio(totales.iva105)} />
      </div>

      <div className="flex justify-end">
        <AccionesFiscal filas={filas} desde={rango.desde} hasta={rango.hasta} />
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[52rem]">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-3 py-2.5">Fecha</th>
                <th className="text-left font-medium px-3 py-2.5">Sucursal</th>
                <th className="text-right font-medium px-3 py-2.5">Pto. vta.</th>
                <th className="text-left font-medium px-3 py-2.5">Cobro</th>
                <th className="text-right font-medium px-3 py-2.5">Neto 21%</th>
                <th className="text-right font-medium px-3 py-2.5">IVA 21%</th>
                <th className="text-right font-medium px-3 py-2.5">Neto 10,5%</th>
                <th className="text-right font-medium px-3 py-2.5">IVA 10,5%</th>
                <th className="text-right font-medium px-3 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filas.map((f, i) => (
                <tr
                  key={`${f.dia}-${f.sucursal_codigo}-${f.metodo}`}
                  className={`hover:bg-neutral-50 ${
                    i > 0 && filas[i - 1].dia !== f.dia
                      ? 'border-t-2 border-neutral-300'
                      : ''
                  }`}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {new Date(f.dia + 'T12:00').toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2.5">{f.sucursal}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-500">
                    {String(f.punto_venta).padStart(5, '0')}
                  </td>
                  <td className="px-3 py-2.5">
                    {ETIQUETA_METODO[f.metodo] ?? f.metodo}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-500">
                    {formatearPrecio(Number(f.neto_21))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-500">
                    {formatearPrecio(Number(f.iva_21))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-500">
                    {Number(f.neto_105) > 0
                      ? formatearPrecio(Number(f.neto_105))
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-500">
                    {Number(f.iva_105) > 0
                      ? formatearPrecio(Number(f.iva_105))
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">
                    {formatearPrecio(Number(f.total))}
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