import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { AccionesFaltantes } from '@/components/reportes/AccionesFaltantes';

export default async function ReporteFaltantes() {
  const sesion = await getSesion();
  const supabase = await createClient();

  const { data } = await supabase
    .from('v_faltantes')
    .select('*')
    .eq('sucursal_id', sesion.sucursalId)
    .order('falta', { ascending: false });

  const filas = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-neutral-500">
          {filas.length} artículos por debajo del stock mínimo
        </p>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <AccionesFaltantes filas={filas} />

          {filas.length > 0 && (
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(aCSV(filas))}`}
              download="faltantes.csv"
              className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-100"
            >
              Descargar CSV
            </a>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[34rem]">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Artículo</th>
                <th className="text-left font-medium px-4 py-2.5">Proveedor</th>
                <th className="text-right font-medium px-4 py-2.5">Disponible</th>
                <th className="text-right font-medium px-4 py-2.5">Mínimo</th>
                <th className="text-right font-medium px-4 py-2.5">Falta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filas.map((f: any) => (
                <tr key={f.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    {f.nombre}
                    {f.codigo_barras && (
                      <span className="ml-2 text-xs text-neutral-400 font-mono">
                        {f.codigo_barras}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {f.proveedor ?? '—'}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono ${
                      Number(f.cantidad_disponible) <= 0 ? 'text-red-600' : ''
                    }`}
                  >
                    {Number(f.cantidad_disponible)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                    {Number(f.stock_minimo)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium">
                    {Number(f.falta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filas.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            Todo el stock está por encima del mínimo
          </p>
        )}
      </div>
    </div>
  );
}

function aCSV(filas: any[]): string {
  const cab = 'articulo,codigo_barras,proveedor,disponible,minimo,falta';
  const cuerpo = filas
    .map((f) =>
      [
        `"${f.nombre}"`,
        f.codigo_barras ?? '',
        `"${f.proveedor ?? ''}"`,
        f.cantidad_disponible,
        f.stock_minimo,
        f.falta,
      ].join(','),
    )
    .join('\n');
  return `${cab}\n${cuerpo}`;
}