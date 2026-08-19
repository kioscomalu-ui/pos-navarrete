'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const REPORTES = [
  { href: '/reportes/ventas', label: 'Ventas' },
  { href: '/reportes/articulos', label: 'Artículos' },
  { href: '/reportes/faltantes', label: 'Faltantes' },
  { href: '/reportes/arqueos', label: 'Arqueos' },
];

export default function ReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>

      <nav className="flex gap-1 border-b border-neutral-200 -mb-px">
        {REPORTES.map((r) => {
          const activo = pathname === r.href || pathname.startsWith(`${r.href}/`);

          return (
            <Link
              key={r.href}
              href={r.href}
              aria-current={activo ? 'page' : undefined}
              className={`px-4 py-2 text-sm border-b-2 transition ${
                activo
                  ? 'text-neutral-900 font-medium border-neutral-900'
                  : 'text-neutral-600 border-transparent hover:text-neutral-900 hover:border-neutral-300'
              }`}
            >
              {r.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}