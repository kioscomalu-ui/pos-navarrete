import Link from 'next/link';
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
  total_filas: number;
}

const POR_PAGINA = 50;

export default async function ReporteArticulos({
  searchParams,
}: {
  searchParams: Promise<{
    rango?: string;
    desde?: string;
    hasta?: string;
    pagina?: string;
    orden?: string;
    dir?: string;
  }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp.rango, sp.desde, sp.hasta);
  const sesion = await getSesion();
  const supabase = await createClient();

  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const offset = (pagina - 1) * POR_PAGINA;
  const orden = sp.orden ?? 'facturado';
  const direccion = sp.dir === 'asc' ? 'asc' : 'desc';

  const { data } = await supabase.rpc('reporte_articulos_periodo', {
    p_desde: rango.desde,
    p_hasta: rango.hasta,
    p_sucursal_id: sesion.rol === 'admin' ? null : sesion.sucursalId,
    p_limite: POR_PAGINA,
    p_offset: offset,
    p_orden: orden,
    p_direccion: direccion,
  });

  const filas = (data ?? []) as FilaArticulo[];
  const totalFilas = filas[0]?.total_filas ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(totalFilas / POR_PAGINA));

  const margenTotal = filas.reduce((a, f) => a + Number(f.margen), 0);

  function urlPagina(p: number): string {
    const params = new URLSearchParams();
    if (sp.rango) params.set('rango', sp.rango);
    if (sp.desde) params.set('desde', sp.desde);
    if (sp.hasta) params.set('hasta', sp.hasta);
    if (sp.orden) params.set('orden', sp.orden);
    if (sp.dir) params.set('dir', sp.dir);
    if (p > 1) params.set('pagina', String(p));
    const qs = params.toString();
    return qs ? `/reportes/articulos?${qs}` : '/reportes/articulos';
  }

  function urlOrden(campo: string): string {
    const params = new URLSearchParams();
    if (sp.rango) params.set('rango', sp.rango);
    if (sp.desde) params.set('desde', sp.desde);
    if (sp.hasta) params.set('hasta', sp.hasta);

    const mismaColumna = orden === campo;
    const dirPorDefecto = campo === 'nombre' ? 'asc' : 'desc';
    const nuevaDireccion = mismaColumna
      ? direccion === 'asc'
        ? 'desc'
        : 'asc'
      : dirPorDefecto;

    params.set('orden', campo);
    params.set('dir', nuevaDireccion);
    return `/reportes/articulos?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <SelectorRango />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tarjeta
          etiqueta="Facturado (esta página)"
          valor={formatearPrecio(filas.reduce((a, f) => a + Number(f.facturado), 0))}
        />
        <Tarjeta
          etiqueta="Margen bruto (esta página)"
          valor={formatearPrecio(margenTotal)}
          destacar
        />
        <Tarjeta etiqueta="Artículos distintos" valor={String(totalFilas)} />
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[32rem]">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
              <tr>
                <ThOrden campo="nombre" label="Artículo" orden={orden} direccion={direccion} urlOrden={urlOrden} align="left" />
                <ThOrden campo="cantidad" label="Vendido" orden={orden} direccion={direccion} urlOrden={urlOrden} />
                <ThOrden campo="facturado" label="Facturado" orden={orden} direccion={direccion} urlOrden={urlOrden} />
                <ThOrden campo="margen" label="Margen" orden={orden} direccion={direccion} urlOrden={urlOrden} />
                <ThOrden campo="porcentaje" label="%" orden={orden} direccion={direccion} urlOrden={urlOrden} />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filas.map((f, i) => (
                <tr key={f.articulo_id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <span className="text-neutral-400 font-mono text-xs mr-2">
                      {offset + i + 1}
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
        </div>

        {filas.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            No hay ventas en este período
          </p>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={urlPagina(pagina - 1)}
            aria-disabled={pagina <= 1}
            className={`px-3 py-2 text-sm rounded border border-neutral-200 bg-white ${
              pagina <= 1 ? 'pointer-events-none opacity-30' : 'hover:bg-neutral-50'
            }`}
          >
            ← Anterior
          </Link>

          <span className="text-sm text-neutral-500 px-2 font-mono">
            {pagina} / {totalPaginas}
          </span>

          <Link
            href={urlPagina(pagina + 1)}
            aria-disabled={pagina >= totalPaginas}
            className={`px-3 py-2 text-sm rounded border border-neutral-200 bg-white ${
              pagina >= totalPaginas
                ? 'pointer-events-none opacity-30'
                : 'hover:bg-neutral-50'
            }`}
          >
            Siguiente →
          </Link>
        </div>
      )}
    </div>
  );
}

function ThOrden({
  campo,
  label,
  orden,
  direccion,
  urlOrden,
  align = 'right',
}: {
  campo: string;
  label: string;
  orden: string;
  direccion: string;
  urlOrden: (campo: string) => string;
  align?: 'left' | 'right';
}) {
  const activo = orden === campo;

  return (
    <th className={`font-medium px-4 py-2.5 text-${align}`}>
      <Link
        href={urlOrden(campo)}
        className={`inline-flex items-center gap-1 hover:text-neutral-900 ${
          activo ? 'text-neutral-900' : ''
        }`}
      >
        {label}
        {activo && <span className="text-[0.65rem]">{direccion === 'asc' ? '▲' : '▼'}</span>}
      </Link>
    </th>
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
      <div className={`font-mono mt-1 ${destacar ? 'text-2xl font-semibold' : 'text-lg'}`}>
        {valor}
      </div>
    </div>
  );
}