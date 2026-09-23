import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { FacturaProveedor } from '@/components/compras/FacturaProveedor';

export const dynamic = 'force-dynamic';

export default async function CargarFacturaPage() {
  const sesion = await getSesion();
  if (!['admin', 'gerente'].includes(sesion.rol)) redirect('/caja');

  const supabase = await createClient();

  const [{ data: proveedores }, { data: sucursal }] = await Promise.all([
    supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
    supabase
      .from('sucursales')
      .select('regla_redondeo')
      .eq('id', sesion.sucursalId)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Factura de proveedor
        </h1>
        <p className="text-sm text-verde-claro mt-0.5">
          Cargá los renglones y actualizá los costos de una sola vez
        </p>
      </div>

      <FacturaProveedor
        proveedores={proveedores ?? []}
        reglaRedondeo={sucursal?.regla_redondeo ?? 'al_peso'}
      />
    </div>
  );
}