import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { PantallaCaja } from '@/components/caja/PantallaCaja';

export default async function CajaPage() {
  const sesion = await getSesion();
  const supabase = await createClient();

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('punto_venta, umbral_diferencia_caja')
    .eq('id', sesion.sucursalId)
    .single();

  return (
    <PantallaCaja
      sucursalId={sesion.sucursalId}
      vendedorId={sesion.usuarioId}
      codigoSucursal={sesion.sucursalCodigo}
      nombreSucursal={sesion.sucursalNombre}
      nombreVendedor={sesion.nombre}
      puntoVenta={sucursal?.punto_venta ?? 1}
      umbralDiferencia={Number(sucursal?.umbral_diferencia_caja ?? 500)}
    />
  );
}