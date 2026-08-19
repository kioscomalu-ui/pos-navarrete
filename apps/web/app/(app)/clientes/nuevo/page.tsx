import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/sesion';
import { FormCliente } from '@/components/clientes/FormCliente';

export default async function NuevoClientePage() {
  const sesion = await getSesion();
  if (!['admin', 'gerente', 'supervisor'].includes(sesion.rol)) {
    redirect('/clientes');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo cliente</h1>
      <FormCliente />
    </div>
  );
}