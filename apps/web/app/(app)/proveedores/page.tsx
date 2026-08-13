import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';

interface FilaProveedor {
  id: string;
  nombre: string;
  codigo_proveedor: string;
  contacto: string | null;
  telefono: string | null;
  vendedor: string | null;
  dias_visita: string | null;
  condiciones_pago: string | null;
  activo: boolean;
  articulos: number;
  articulos_principal: number;
  ultimo_aumento: string | null;
  variacion_media: number | null;
}

export default async function ProveedoresPage() {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();
  const { data } = await supabase.rpc('resumen_proveedores');
  const filas = (data ?? []) as FilaProveedor[];

  const activos = filas.filter((f) => f.activo);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
          <p className="text-sm text-verde-claro mt-0.5">
            <span className="num">{activos.length}</span> activos · cargalos
            una vez y después asignalos a cada artículo
          </p>
        </div>

        <Link
          href="/proveedores/nuevo"
          className="px-3 py-2 text-sm rounded-lg bg-verde-esmalte text-white
                     hover:bg-verde-hondo whitespace-nowrap"
        >
          Nuevo proveedor
        </Link>
      </div>

      {filas.length === 0 && (
        <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 py-16 text-center">
          <p className="text-verde-claro">Todavía no cargaste proveedores</p>
          <p className="text-sm text-verde-claro/70 mt-2 max-w-sm mx-auto">
            Cargá primero los que te visitan seguido. Después, en cada artículo
            vas a poder indicar cuál te lo vende, con qué código y a qué costo.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filas.map((p) => (
          <div
            key={p.id}
            className={`bg-mostrador rounded-lg ring-1 ring-tiza/60 p-5 ${
              !p.activo ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-medium">
                  <Link
                    href={`/proveedores/${p.id}`}
                    className="hover:underline"
                  >
                    {p.nombre}
                  </Link>
                  <span className="num text-xs text-verde-claro ml-2">
                    {p.codigo_proveedor}
                  </span>
                  {!p.activo && (
                    <span className="text-xs text-verde-claro ml-2 font-normal">
                      inactivo
                    </span>
                  )}
                </h2>

                <div className="text-sm text-verde-claro mt-1 space-x-3">
                  {p.vendedor && <span>{p.vendedor}</span>}
                  {p.telefono && (
                    <span className="num">{p.telefono}</span>
                  )}
                  {p.dias_visita && <span>pasa {p.dias_visita}</span>}
                </div>

                {p.condiciones_pago && (
                  <p className="text-xs text-verde-claro/70 mt-1">
                    {p.condiciones_pago}
                  </p>
                )}
              </div>

              <div className="text-right shrink-0 text-sm">
                <div>
                  <span className="num font-medium">{p.articulos}</span>
                  <span className="text-verde-claro text-xs ml-1">
                    {p.articulos === 1 ? 'artículo' : 'artículos'}
                  </span>
                </div>

                {p.articulos_principal > 0 && (
                  <div className="text-xs text-verde-claro mt-0.5">
                    <span className="num">{p.articulos_principal}</span> como
                    principal
                  </div>
                )}

                {p.variacion_media != null && (
                  <div className="num text-xs text-rojo-plomo mt-1">
                    +{Number(p.variacion_media)}% promedio (3 meses)
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-3 pt-3 border-t border-tiza/40 text-xs">
              <Link
                href={`/proveedores/${p.id}`}
                className="text-verde-claro hover:text-verde-esmalte"
              >
                Ver artículos
              </Link>
              <Link
                href={`/proveedores/${p.id}/editar`}
                className="text-verde-claro hover:text-verde-esmalte"
              >
                Editar
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}