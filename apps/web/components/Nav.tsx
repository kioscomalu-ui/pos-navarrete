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
  { href: '/proveedores', label: 'Proveedores', roles: ['admin', 'gerente'] },
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
    <header className="bg-verde-esmalte sticky top-0 z-30 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-5">
        <Link
          href="/caja"
          className="font-black tracking-tight text-white whitespace-nowrap
                     hover:text-tiza transition-colors"
        >
          NAVARRETE
        </Link>

        <nav className="flex gap-1 flex-1 overflow-x-auto">
          {visibles.map((s) => {
            const activo =
              pathname === s.href || pathname.startsWith(`${s.href}/`);

            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={activo ? 'page' : undefined}
                className={`px-3 py-1.5 rounded text-sm whitespace-nowrap transition ${
                  activo
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-tiza hover:bg-white/10 hover:text-white'
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>

        <BotonChat ctx={{ usuarioId, nombreUsuario: nombre, sucursalId }} />

        <div className="text-right text-xs leading-tight hidden sm:block">
          <div className="font-medium text-white">{nombreCompleto}</div>
          <div className="text-tiza/70">
            {rol} · {sucursalNombre}
          </div>
        </div>

        <button
          onClick={salir}
          className="text-sm text-tiza hover:text-white whitespace-nowrap transition-colors"
        >
          Salir
        </button>
      </div>
    </header>
  );
}