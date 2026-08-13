import { getSesion } from '@/lib/sesion';
import { createClient } from '@/lib/supabase-server';
import { PantallaCobranzas } from '@/components/cobranzas/PantallaCobranzas';

export default async function CobranzasPage() {
  const sesion = await getSesion();
  const supabase = await createClient();

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('punto_venta')
    .eq('id', sesion.sucursalId)
    .single();

  return (
    <PantallaCobranzas
      cobradorId={sesion.usuarioId}
      nombreCobrador={sesion.nombre}
      puntoVenta={sucursal?.punto_venta ?? 1}
    />
  );
}