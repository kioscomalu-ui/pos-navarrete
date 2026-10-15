// ---------------------------------------------------------------------
// Reemplaza a: apps/web/app/(app)/caja/page.tsx
// ---------------------------------------------------------------------

import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { PantallaCaja } from '@/components/caja/PantallaCaja';
import { IdentidadVendedor } from '@/components/caja/IdentidadVendedor';

export default async function CajaPage() {
  const sesion = await getSesion();
  const supabase = await createClient();

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('punto_venta, umbral_diferencia_caja')
    .eq('id', sesion.sucursalId)
    .single();

  // Nombre y apellido: en la barra hace falta saber cuál Florencia es,
  // no solo que hay una Florencia.
  const nombreCompleto = [sesion.nombre, sesion.apellido].filter(Boolean).join(' ');

  return (
    <>
      <IdentidadVendedor
        nombre={nombreCompleto}
        sucursal={sesion.sucursalNombre}
      />

      <PantallaCaja
        sucursalId={sesion.sucursalId}
        vendedorId={sesion.usuarioId}
        codigoSucursal={sesion.sucursalCodigo}
        nombreSucursal={sesion.sucursalNombre}
        nombreVendedor={sesion.nombre}
        puntoVenta={sucursal?.punto_venta ?? 1}
        umbralDiferencia={Number(sucursal?.umbral_diferencia_caja ?? 500)}
        rol={sesion.rol}
      />
    </>
  );
}