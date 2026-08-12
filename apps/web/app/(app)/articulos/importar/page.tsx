import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { redirect } from 'next/navigation';
import { ImportadorCSV } from '@/components/articulos/ImportadorCSV';

export default async function ImportarPage() {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) redirect('/articulos');

  const supabase = await createClient();

  const [{ data: articulos }, { data: categorias }, { data: sucursal }] =
    await Promise.all([
      supabase.from('articulos').select('codigo_barras').not('codigo_barras', 'is', null),
      supabase.from('categorias_articulos').select('nombre'),
      supabase.from('sucursales').select('regla_redondeo, nombre').eq('id', sesion.sucursalId).single(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar artículos</h1>
        <p className="text-sm text-neutral-500">
          El stock inicial se carga en {sucursal?.nombre}
        </p>
      </div>

      <ImportadorCSV
        codigosExistentes={(articulos ?? []).map((a) => a.codigo_barras!)}
        categoriasExistentes={(categorias ?? []).map((c) => c.nombre)}
        reglaRedondeo={sucursal?.regla_redondeo ?? 'al_peso'}
      />
    </div>
  );
}