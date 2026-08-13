import { redirect } from 'next/navigation';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { FormProveedor } from '@/components/proveedores/FormProveedor';

export default async function NuevoProveedor() {
  const sesion = await getSesion();
  if (!puedeEditarCatalogo(sesion.rol)) redirect('/articulos');

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo proveedor</h1>
      <FormProveedor />
    </div>
  );
}