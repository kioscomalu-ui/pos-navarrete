'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECCIONES = [
  { href: '/admin/cajas', label: 'Cajas abiertas', soloAdmin: false },
  { href: '/admin/usuarios', label: 'Usuarios', soloAdmin: true },
  { href: '/admin/sucursales', label: 'Sucursales', soloAdmin: true },
  { href: '/admin/mantenimiento', label: 'Mantenimiento', soloAdmin: true },
];

export function NavAdmin({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const visibles = SECCIONES.filter((s) => esAdmin || !s.soloAdmin);

  return (
    <nav className="flex gap-1 border-b border-neutral-200 -mb-px overflow-x-auto">
      {visibles.map((s) => {
        const activo = pathname === s.href || pathname.startsWith(`${s.href}/`);

        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activo ? 'page' : undefined}
            className={`px-4 py-2 text-sm border-b-2 transition whitespace-nowrap ${
              activo
                ? 'text-neutral-900 font-medium border-neutral-900'
                : 'text-neutral-600 border-transparent hover:text-neutral-900 hover:border-neutral-300'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}