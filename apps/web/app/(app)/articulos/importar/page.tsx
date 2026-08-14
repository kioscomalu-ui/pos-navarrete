import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { ImportadorCSV } from '@/components/articulos/ImportadorCSV';

export default async function ImportarPage() {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();

  const [{ data: articulos }, { data: categorias }, { data: sucursal }] =
    await Promise.all([
      supabase
        .from('articulos')
        .select('codigo_barras')
        .not('codigo_barras', 'is', null),

      supabase.from('categorias_articulos').select('nombre'),

      supabase
        .from('sucursales')
        .select('nombre, regla_redondeo')
        .eq('id', sesion.sucursalId)
        .maybeSingle(),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Importar artículos
          </h1>
          <p className="text-sm text-verde-claro mt-1">
            Revisá los precios en la previsualización antes de confirmar. El
            stock inicial se carga en {sucursal?.nombre ?? 'tu sucursal'}.
          </p>
        </div>

        <Link
          href="/articulos"
          className="px-3 py-2 text-sm rounded-lg ring-1 ring-tiza/60 bg-mostrador
                     whitespace-nowrap shrink-0"
        >
          Volver al listado
        </Link>
      </div>

      <ImportadorCSV
        codigosExistentes={(articulos ?? [])
          .map((a) => a.codigo_barras)
          .filter((c): c is string => !!c)}
        categoriasExistentes={(categorias ?? []).map((c) => c.nombre)}
        reglaRedondeo={sucursal?.regla_redondeo ?? 'al_peso'}
        nombreSucursal={sucursal?.nombre ?? ''}
      />
    </div>
  );
}