'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const SECCIONES = [
  { href: '/caja',      label: 'Caja' },
  { href: '/articulos', label: 'Artículos' },
  { href: '/reportes',  label: 'Reportes' },
  { href: '/admin',     label: 'Administración', soloAdmin: true },
];

interface Props {
  nombre: string;
  rol: string;
  sucursal: string;
}

export function Nav({ nombre, rol, sucursal }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function salir() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
        <Link href="/" className="font-semibold tracking-tight whitespace-nowrap">
          Navarrete
        </Link>

        <nav className="flex gap-1 flex-1">
          {SECCIONES
            .filter((s) => !s.soloAdmin || rol === 'admin')
            .map((s) => {
              const activo = pathname.startsWith(s.href);
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={`px-3 py-1.5 rounded text-sm transition ${
                    activo
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
        </nav>

        <div className="text-right text-xs leading-tight">
          <div className="font-medium">{nombre}</div>
          <div className="text-neutral-500">{rol} · {sucursal}</div>
        </div>

        <button
          onClick={salir}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          Salir
        </button>
      </div>
    </header>
  );
}