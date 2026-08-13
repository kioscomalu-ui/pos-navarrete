import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface FilaArticulo {
  articulo_id: string;
  nombre: string;
  codigo_barras: string | null;
  codigo_proveedor: string | null;
  presentacion: string | null;
  costo: number;
  es_principal: boolean;
  ultimo_cambio: string | null;
}

export default async function FichaProveedor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();

  const [{ data: proveedor }, { data: articulos }] = await Promise.all([
    supabase.from('proveedores').select('*').eq('id', id).maybeSingle(),
    supabase.rpc('articulos_de_proveedor', { p_proveedor_id: id }),
  ]);

  if (!proveedor) notFound();

  const filas = (articulos ?? []) as FilaArticulo[];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {proveedor.nombre}
          </h1>
          <p className="text-sm text-verde-claro mt-0.5">
            <span className="num">{proveedor.codigo_proveedor}</span>
            {proveedor.vendedor && ` · ${proveedor.vendedor}`}
            {proveedor.telefono && (
              <>
                {' · '}
                <span className="num">{proveedor.telefono}</span>
              </>
            )}
          </p>
        </div>

        <Link
          href={`/proveedores/${id}/editar`}
          className="px-3 py-2 text-sm rounded-lg ring-1 ring-tiza/60 bg-mostrador"
        >
          Editar datos
        </Link>
      </div>

      {(proveedor.condiciones_pago ||
        proveedor.dias_visita ||
        proveedor.observaciones) && (
        <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-5 grid grid-cols-3 gap-4 text-sm">
          {proveedor.condiciones_pago && (
            <div>
              <dt className="text-xs text-verde-claro">Condiciones de pago</dt>
              <dd>{proveedor.condiciones_pago}</dd>
            </div>
          )}
          {proveedor.dias_visita && (
            <div>
              <dt className="text-xs text-verde-claro">Visita</dt>
              <dd>{proveedor.dias_visita}</dd>
            </div>
          )}
          {proveedor.observaciones && (
            <div>
              <dt className="text-xs text-verde-claro">Observaciones</dt>
              <dd>{proveedor.observaciones}</dd>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium mb-3">
          Artículos que provee{' '}
          <span className="num text-verde-claro font-normal">
            ({filas.length})
          </span>
        </h2>

        <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[40rem]">
              <thead className="bg-papel text-verde-claro text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Artículo</th>
                  <th className="text-left font-medium px-4 py-2.5">
                    Su código
                  </th>
                  <th className="text-left font-medium px-4 py-2.5">
                    Presentación
                  </th>
                  <th className="text-right font-medium px-4 py-2.5">Costo</th>
                  <th className="text-right font-medium px-4 py-2.5">
                    Actualizado
                  </th>
                </tr>
              </thead>

              <tbody>
                {filas.map((f, i) => (
                  <tr
                    key={f.articulo_id}
                    className={i % 2 === 0 ? 'renglon-impar' : 'renglon-par'}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/articulos/${f.articulo_id}`}
                        className="hover:underline"
                      >
                        {f.nombre}
                      </Link>
                      {f.es_principal && (
                        <span className="text-[0.65rem] uppercase tracking-wide
                                         bg-verde-esmalte text-white px-1.5 py-0.5
                                         rounded ml-2">
                          principal
                        </span>
                      )}
                    </td>
                    <td className="num px-4 py-2.5 text-xs">
                      {f.codigo_proveedor ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-verde-claro">
                      {f.presentacion ?? '—'}
                    </td>
                    <td className="num px-4 py-2.5 text-right font-medium">
                      {formatearPrecio(Number(f.costo))}
                    </td>
                    <td className="num px-4 py-2.5 text-right text-xs text-verde-claro">
                      {f.ultimo_cambio
                        ? new Date(f.ultimo_cambio).toLocaleDateString('es-AR')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filas.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-verde-claro/70">
              Todavía no le asignaste artículos. Se hace desde la ficha de cada
              artículo, en el panel de proveedores.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}