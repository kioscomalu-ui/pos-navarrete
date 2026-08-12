import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import { calcularMargen } from '@pos/shared/utils/calcular-precio';

export default async function ArticulosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const sesion = await getSesion();
  const supabase = await createClient();

  let query = supabase
    .from('articulos')
    .select(`
      id, codigo_barras, nombre, unidad, activo,
      costo_unitario, precio_venta_final,
      categorias_articulos(nombre),
      stock_sucursal(cantidad_disponible, sucursal_id)
    `)
    .order('nombre')
    .limit(100);

  if (q) query = query.ilike('nombre', `%${q}%`);

  const { data: articulos, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Artículos</h1>
          <p className="text-sm text-neutral-500">
            {articulos?.length ?? 0} artículos
          </p>
        </div>

        {puedeEditarCatalogo(sesion.rol) && (
          <div className="flex gap-2">
            <Link
              href="/articulos/importar"
              className="px-3 py-2 text-sm border border-neutral-300 rounded hover:bg-neutral-100"
            >
              Importar CSV
            </Link>
            <Link
              href="/articulos/nuevo"
              className="px-3 py-2 text-sm bg-neutral-900 text-white rounded"
            >
              Nuevo artículo
            </Link>
          </div>
        )}
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre…"
          className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm"
        />
        <button className="px-4 py-2 text-sm border border-neutral-300 rounded hover:bg-neutral-100">
          Buscar
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 font-mono">{error.message}</p>
      )}

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Artículo</th>
              <th className="text-left font-medium px-4 py-2.5">Código</th>
              <th className="text-right font-medium px-4 py-2.5">Costo</th>
              <th className="text-right font-medium px-4 py-2.5">Precio</th>
              <th className="text-right font-medium px-4 py-2.5">Margen</th>
              <th className="text-right font-medium px-4 py-2.5">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {articulos?.map((a) => {
              const margen = calcularMargen(a.costo_unitario, a.precio_venta_final ?? 0);
              const stock = (a.stock_sucursal as { cantidad_disponible: number; sucursal_id: string }[])
                ?.find((s) => s.sucursal_id === sesion.sucursalId);

              return (
                <tr key={a.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/articulos/${a.id}`} className="hover:underline">
                      {a.nombre}
                    </Link>
                    {!a.activo && (
                      <span className="ml-2 text-xs text-neutral-400">inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-neutral-500">
                    {a.codigo_barras ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatearPrecio(a.costo_unitario)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium">
                    {formatearPrecio(a.precio_venta_final ?? 0)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${
                    margen.porcentaje < 10 ? 'text-red-600' : 'text-neutral-500'
                  }`}>
                    {margen.porcentaje}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {stock?.cantidad_disponible ?? 0}
                    <span className="text-neutral-400 ml-1 text-xs">
                      {a.unidad === 'unidad' ? 'un' : a.unidad}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {articulos?.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            {q ? 'No se encontraron artículos' : 'Todavía no hay artículos cargados'}
          </p>
        )}
      </div>
    </div>
  );
}