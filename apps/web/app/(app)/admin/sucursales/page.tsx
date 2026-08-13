import { createClient } from '@/lib/supabase-server';
import { formatearPrecio } from '@pos/shared/constants/empresa';

export default async function SucursalesPage() {
  const supabase = await createClient();

  const { data: sucursales } = await supabase
    .from('sucursales')
    .select('*')
    .order('punto_venta');

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-500">
        Cada caja necesita su propio punto de venta. Dos terminales con el mismo
        número generan remitos duplicados cuando trabajan sin conexión.
      </p>

      <div className="space-y-3">
        {(sucursales ?? []).map((s) => (
          <div
            key={s.id}
            className="bg-white border border-neutral-200 rounded p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-medium">{s.nombre}</h2>
                <p className="text-sm text-neutral-500">
                  {s.codigo} · punto de venta {s.punto_venta}
                  {s.ciudad && ` · ${s.ciudad}`}
                </p>
              </div>
              {!s.activa && (
                <span className="text-xs text-neutral-400">inactiva</span>
              )}
            </div>

            <dl className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div>
                <dt className="text-xs text-neutral-500">Redondeo</dt>
                <dd>{etiquetaRedondeo(s.regla_redondeo)}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Margen por defecto</dt>
                <dd className="font-mono">{Number(s.margen_default)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">
                  Umbral de diferencia de caja
                </dt>
                <dd className="font-mono">
                  {formatearPrecio(Number(s.umbral_diferencia_caja ?? 0))}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function etiquetaRedondeo(r: string) {
  const mapa: Record<string, string> = {
    sin_redondeo: 'Sin redondeo',
    al_peso: 'Al peso entero',
    al_cincuenta: 'A .00 o .50',
    a_la_decena: 'A la decena',
  };
  return mapa[r] ?? r;
}