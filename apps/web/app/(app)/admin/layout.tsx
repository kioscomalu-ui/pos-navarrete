import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSesion } from '@/lib/sesion';

const SECCIONES = [
  { href: '/admin/usuarios', label: 'Usuarios' },
  { href: '/admin/sucursales', label: 'Sucursales' },
  { href: '/admin/mantenimiento', label: 'Mantenimiento' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') redirect('/caja');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>

      <nav className="flex gap-1 border-b border-neutral-200 -mb-px">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900
                       border-b-2 border-transparent hover:border-neutral-300"
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}