import Link from 'next/link';

const REPORTES = [
  { href: '/reportes/ventas',    label: 'Ventas' },
  { href: '/reportes/articulos', label: 'Artículos' },
  { href: '/reportes/faltantes', label: 'Faltantes' },
  { href: '/reportes/arqueos',   label: 'Arqueos' },
];

export default function ReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>

      <nav className="flex gap-1 border-b border-neutral-200 -mb-px">
        {REPORTES.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900
                       border-b-2 border-transparent hover:border-neutral-300"
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}