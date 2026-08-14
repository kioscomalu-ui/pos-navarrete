import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { formatearPrecio } from '@pos/shared/constants/empresa';

export default async function PreciosFijos() {
  const supabase = await createClient();
  const { data } = await supabase.from('v_precios_manuales').select('*');
  const filas = data ?? [];

  const enRiesgo = filas.filter(
    (f: any) => f.margen_real != null && Number(f.margen_real) < 15,
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-verde-claro">
          Artículos con el precio fijado a mano. No se recalculan cuando sube
          el costo, así que el margen se les va achicando con cada aumento.
        </p>
      </div>

      {enRiesgo.length > 0 && (
        <div className="bg-ambar-suave border-l-4 border-ambar-dial rounded-r px-4 py-3">
          <p className="text-sm">
            <span className="num font-medium">{enRiesgo.length}</span> de estos
            artículos quedaron con menos del 15% de margen. Conviene revisarlos.
          </p>
        </div>
      )}

      <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-papel text-verde-claro text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Artículo</th>
              <th className="text-left font-medium px-4 py-2.5">Categoría</th>
              <th className="text-right font-medium px-4 py-2.5">Costo</th>
              <th className="text-right font-medium px-4 py-2.5">Precio</th>
              <th className="text-right font-medium px-4 py-2.5">Margen</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f: any, i: number) => {
              const margen = Number(f.margen_real ?? 0);
              return (
                <tr
                  key={f.id}
                  className={i % 2 === 0 ? 'renglon-impar' : 'renglon-par'}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/articulos/${f.id}`}
                      className="hover:underline"
                    >
                      {f.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-verde-claro">
                    {f.categoria ?? '—'}
                  </td>
                  <td className="num px-4 py-2.5 text-right text-verde-claro">
                    {formatearPrecio(Number(f.costo_unitario))}
                  </td>
                  <td className="num px-4 py-2.5 text-right font-medium">
                    {formatearPrecio(Number(f.precio_venta_final))}
                  </td>
                  <td
                    className={`num px-4 py-2.5 text-right ${
                      margen < 15 ? 'text-rojo-plomo font-medium' : 'text-verde-claro'
                    }`}
                  >
                    {margen}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filas.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-verde-claro/70">
            No hay artículos con precio fijado a mano
          </p>
        )}
      </div>
    </div>
  );
}