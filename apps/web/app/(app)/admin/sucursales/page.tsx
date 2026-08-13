import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import { BotonActivarSucursal } from '@/components/admin/BotonActivarSucursal';

const REDONDEOS: Record<string, string> = {
  sin_redondeo: 'Sin redondeo',
  al_peso: 'Al peso entero',
  al_cincuenta: 'A .00 o .50',
  a_la_decena: 'A la decena',
};

export default async function SucursalesPage() {
  const sesion = await getSesion();
  const supabase = await createClient();

  const { data: sucursales } = await supabase
    .from('sucursales')
    .select('*')
    .order('punto_venta');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-verde-claro max-w-md">
          Cada caja necesita su propio punto de venta. Dos terminales con el
          mismo número generan remitos duplicados cuando trabajan sin conexión.
        </p>
        <Link
          href="/admin/sucursales/nuevo"
          className="px-3 py-2 text-sm rounded-lg bg-verde-esmalte text-white
                     whitespace-nowrap"
        >
          Nueva sucursal
        </Link>
      </div>

      <div className="space-y-3">
        {(sucursales ?? []).map((s) => (
          <div
            key={s.id}
            className={`bg-mostrador rounded-lg ring-1 ring-tiza/60 p-5 ${
              !s.activa ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium">
                  {s.nombre}
                  {s.id === sesion.sucursalId && (
                    <span className="ml-2 text-xs text-verde-claro font-normal">
                      donde estás
                    </span>
                  )}
                  {!s.activa && (
                    <span className="ml-2 text-xs text-verde-claro font-normal">
                      inactiva
                    </span>
                  )}
                </h3>
                <p className="text-sm text-verde-claro mt-0.5">
                  <span className="num">{s.codigo}</span> · punto de venta{' '}
                  <span className="num">{s.punto_venta}</span>
                  {s.ciudad && ` · ${s.ciudad}`}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <BotonActivarSucursal
                  id={s.id}
                  activa={s.activa}
                  esPropia={s.id === sesion.sucursalId}
                />
                <Link
                  href={`/admin/sucursales/${s.id}`}
                  className="text-sm text-verde-claro hover:text-verde-esmalte"
                >
                  Editar
                </Link>
              </div>
            </div>

            <dl className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-tiza/50 text-sm">
              <div>
                <dt className="text-xs text-verde-claro">Redondeo</dt>
                <dd>{REDONDEOS[s.regla_redondeo] ?? s.regla_redondeo}</dd>
              </div>
              <div>
                <dt className="text-xs text-verde-claro">Margen por defecto</dt>
                <dd className="num">{Number(s.margen_default)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-verde-claro">Umbral de caja</dt>
                <dd className="num">
                  {formatearPrecio(Number(s.umbral_diferencia_caja ?? 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-verde-claro">Historial local</dt>
                <dd className="num">
                  {Number(s.dias_retencion_local ?? 45)} días
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}