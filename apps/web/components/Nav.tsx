'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BotonChat } from '@/components/chat/BotonChat';
import type { RolUsuario } from '@pos/shared/types';

interface Seccion {
  href: string;
  label: string;
  /** Si se omite, la ve cualquier rol */
  roles?: RolUsuario[];
}

const SECCIONES: Seccion[] = [
  { href: '/caja', label: 'Caja' },
  { href: '/articulos', label: 'Artículos' },
  { href: '/clientes', label: 'Clientes', roles: ['admin', 'gerente', 'supervisor'] },
  { href: '/cobranzas', label: 'Cobranzas', roles: ['admin', 'gerente', 'cobrador'] },
  { href: '/reportes', label: 'Reportes', roles: ['admin', 'gerente', 'supervisor'] },
  { href: '/admin', label: 'Administración', roles: ['admin'] },
];

interface Props {
  usuarioId: string;
  nombre: string;
  apellido: string | null;
  rol: RolUsuario;
  sucursalId: string;
  sucursalNombre: string;
}

export function Nav({
  usuarioId,
  nombre,
  apellido,
  rol,
  sucursalId,
  sucursalNombre,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const visibles = SECCIONES.filter((s) => !s.roles || s.roles.includes(rol));
  const nombreCompleto = `${nombre} ${apellido ?? ''}`.trim();

  async function salir() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link
          href="/caja"
          className="font-semibold tracking-tight whitespace-nowrap"
        >
          Navarrete
        </Link>

        <nav className="flex gap-1 flex-1 overflow-x-auto">
          {visibles.map((s) => {
            const activo =
              pathname === s.href || pathname.startsWith(`${s.href}/`);

            return (
              <Link
                key={s.href}
                href={s.href}
                className={`px-3 py-1.5 rounded text-sm whitespace-nowrap transition ${
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

        <BotonChat
          ctx={{ usuarioId, nombreUsuario: nombre, sucursalId }}
        />

        <div className="text-right text-xs leading-tight hidden sm:block">
          <div className="font-medium">{nombreCompleto}</div>
          <div className="text-neutral-500">
            {rol} · {sucursalNombre}
          </div>
        </div>

        <button
          onClick={salir}
          className="text-sm text-neutral-500 hover:text-neutral-900 whitespace-nowrap"
        >
          Salir
        </button>
      </div>
    </header>
  );
}