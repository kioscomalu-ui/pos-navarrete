import { createClient } from '@/lib/supabase-server';

export default async function ReporteProveedores() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('ranking_aumentos_proveedores', {
    p_meses: 3,
  });

  return (
    <div className="space-y-5">
      <p className="text-sm text-verde-claro">
        Aumentos registrados en los últimos 3 meses, ordenados por variación
        promedio.
      </p>

      <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-papel text-verde-claro text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Proveedor</th>
              <th className="text-right font-medium px-4 py-2.5">Artículos</th>
              <th className="text-right font-medium px-4 py-2.5">Aumentos</th>
              <th className="text-right font-medium px-4 py-2.5">Promedio</th>
              <th className="text-right font-medium px-4 py-2.5">Máximo</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((f: any, i: number) => (
              <tr
                key={f.proveedor}
                className={i % 2 === 0 ? 'renglon-impar' : 'renglon-par'}
              >
                <td className="px-4 py-2.5">{f.proveedor}</td>
                <td className="num px-4 py-2.5 text-right text-verde-claro">
                  {f.articulos}
                </td>
                <td className="num px-4 py-2.5 text-right text-verde-claro">
                  {f.aumentos}
                </td>
                <td className="num px-4 py-2.5 text-right font-medium">
                  +{Number(f.variacion_media)}%
                </td>
                <td className="num px-4 py-2.5 text-right text-rojo-plomo">
                  +{Number(f.variacion_maxima)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}