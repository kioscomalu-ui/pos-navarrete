import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/sesion';

export default async function AdminIndex() {
  const sesion = await getSesion();

  // Un gerente solo tiene acceso a Cajas abiertas: mandarlo a
  // Usuarios lo dejaría rebotando contra una página que no puede ver.
  redirect(sesion.rol === 'admin' ? '/admin/usuarios' : '/admin/cajas');
}