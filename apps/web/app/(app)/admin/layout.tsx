import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/sesion';
import { NavAdmin } from '@/components/admin/NavAdmin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await getSesion();

  // Gerente entra solo a Cajas abiertas: necesita poder regularizar
  // una caja que quedó sin cerrar, pero no administrar usuarios ni
  // sucursales.
  const esAdmin = sesion.rol === 'admin';
  const esGerente = sesion.rol === 'gerente';

  if (!esAdmin && !esGerente) redirect('/caja');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
      <NavAdmin esAdmin={esAdmin} />
      {children}
    </div>
  );
}