import { createClient } from '@/lib/supabase-server';
import { GestionPeriodos } from '@/components/admin/GestionPeriodos';

export default async function MantenimientoPage() {
  const supabase = await createClient();

  const [{ data: estado }, { data: espacio }, { data: meses }, { data: cierres }] =
    await Promise.all([
      supabase.rpc('estado_base'),
      supabase.from('v_espacio_tablas').select('*').limit(8),
      supabase.rpc('ventas_por_mes'),
      supabase
        .from('cierres_periodo')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

  const e = estado?.[0];

  return (
    <div className="space-y-8">
      {/* Estado general */}
      <section className="space-y-3">
        <h2 className="font-medium">Estado de la base</h2>

        <div className="grid grid-cols-4 gap-3">
          <Tarjeta etiqueta="Tamaño total" valor={e?.total_legible ?? '—'} destacar />
          <Tarjeta etiqueta="Ventas" valor={String(e?.ventas_totales ?? 0)} />
          <Tarjeta
            etiqueta="Venta más antigua"
            valor={
              e?.venta_mas_antigua
                ? new Date(e.venta_mas_antigua + 'T12:00').toLocaleDateString('es-AR')
                : '—'
            }
          />
          <Tarjeta
            etiqueta="Sin sincronizar"
            valor={String(e?.sin_sincronizar ?? 0)}
            alerta={Number(e?.sin_sincronizar ?? 0) > 0}
          />
        </div>

        <p className="text-xs text-neutral-500">
          Referencia: el plan gratuito de Supabase incluye 500 MB y el Pro 8 GB.
          Con 300 ventas diarias, la base crece unos 150 MB por año.
        </p>
      </section>

      {/* Espacio por tabla */}
      <section className="space-y-3">
        <h2 className="font-medium">Tablas más grandes</h2>

        <div className="bg-white border border-neutral-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-neutral-100">
              {(espacio ?? []).map((t: any) => (
                <tr key={t.tabla}>
                  <td className="px-4 py-2 font-mono text-xs">{t.tabla}</td>
                  <td className="px-4 py-2 text-right text-neutral-500">
                    {Number(t.filas).toLocaleString('es-AR')} filas
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{t.tamanio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Depuración */}
      <GestionPeriodos
        meses={(meses ?? []) as any[]}
        cierres={(cierres ?? []) as any[]}
      />
    </div>
  );
}

function Tarjeta({
  etiqueta, valor, destacar, alerta,
}: { etiqueta: string; valor: string; destacar?: boolean; alerta?: boolean }) {
  return (
    <div className="bg-white border border-neutral-200 rounded p-4">
      <div className="text-xs text-neutral-500">{etiqueta}</div>
      <div
        className={`font-mono mt-1 ${destacar ? 'text-2xl font-semibold' : 'text-lg'} ${
          alerta ? 'text-amber-700' : ''
        }`}
      >
        {valor}
      </div>
    </div>
  );
}