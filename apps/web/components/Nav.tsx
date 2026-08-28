'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BotonChat } from '@/components/chat/BotonChat';
import { SelectorSucursal } from '@/components/SelectorSucursal';
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
  { href: '/proveedores', label: 'Proveedores', roles: ['admin', 'gerente'] },
  { href: '/clientes', label: 'Clientes', roles: ['admin', 'gerente', 'supervisor'] },
  { href: '/cobranzas', label: 'Cobranzas', roles: ['admin', 'gerente', 'cobrador'] },
  { href: '/reportes', label: 'Reportes', roles: ['admin', 'gerente', 'supervisor'] },
  { href: '/admin', label: 'Administración', roles: ['admin', 'gerente'] },
];

interface Props {
  usuarioId: string;
  nombre: string;
  apellido: string | null;
  rol: RolUsuario;
  sucursalId: string;
  sucursalNombre: string;
  sucursalesAutorizadas: { id: string; nombre: string; esPrincipal: boolean }[];
}

export function Nav({
  usuarioId,
  nombre,
  apellido,
  rol,
  sucursalId,
  sucursalNombre,
  sucursalesAutorizadas,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const visibles = SECCIONES.filter((s) => !s.roles || s.roles.includes(rol));
  const nombreCompleto = `${nombre} ${apellido ?? ''}`.trim();

  async function salir() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function esActiva(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="bg-verde-esmalte sticky top-0 z-30 shadow-sm overflow-x-hidden">
      {/* ============================================================
          Fila principal, ancho completo.
          Las secciones (Caja, Artículos...) aparecen desde sm.
          El bloque de cuenta (nombre, sucursal, chat, mi cuenta,
          salir) recién aparece desde xl (1280px): a 1024px (lg) no
          entraba cómodo con siete secciones + todo lo demás, y en
          notebooks con escalado de Windows el ancho disponible en
          píxeles CSS es menor de lo que parece por el tamaño físico
          de la pantalla. Por debajo de xl, todo eso vive en el panel
          de la hamburguesa.
          ============================================================ */}
      <div className="w-full px-4 sm:px-6 xl:px-10 h-14 xl:h-16
                      flex items-center gap-3 sm:gap-5 xl:gap-8">
        <Link
          href="/caja"
          className="font-black tracking-tight text-white whitespace-nowrap
                     hover:text-tiza transition-colors text-base xl:text-lg"
        >
          NAVARRETE
        </Link>

        {/* Secciones: desde sm. A este nivel es solo texto + logo +
            hamburguesa, hay lugar de sobra para que no desborde. */}
        <nav className="hidden sm:flex gap-1 xl:gap-2 flex-1">
          {visibles.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              aria-current={esActiva(s.href) ? 'page' : undefined}
              className={`px-3 xl:px-4 py-1.5 xl:py-2 rounded-md text-sm
                         whitespace-nowrap transition ${
                esActiva(s.href)
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-tiza hover:bg-white/10 hover:text-white'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        {/* Empuja el resto a la derecha cuando las secciones no están
            en esta fila (por debajo de sm) */}
        <div className="flex-1 sm:hidden" />

        <BotonChat ctx={{ usuarioId, nombreUsuario: nombre, sucursalId }} />

        {/* Bloque de cuenta: recién desde xl */}
        <div className="hidden xl:flex items-center gap-6 border-l border-white/15 pl-6 shrink-0">
          <div className="text-right text-xs leading-tight">
            <div className="font-medium text-white">{nombreCompleto}</div>
            <div className="text-tiza/70 flex items-center justify-end gap-1.5 mt-0.5">
              <span>
                {rol} · {sucursalNombre}
              </span>
              <SelectorSucursal
                sucursalActual={sucursalId}
                sucursales={sucursalesAutorizadas}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/cuenta"
              className="text-sm text-tiza hover:text-white whitespace-nowrap transition-colors"
            >
              Mi cuenta
            </Link>
            <button
              onClick={salir}
              className="text-sm text-tiza hover:text-white whitespace-nowrap transition-colors"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Hamburguesa: hasta xl */}
        <button
          onClick={() => setMenuAbierto((a) => !a)}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          className="xl:hidden w-9 h-9 flex items-center justify-center rounded
                     text-white hover:bg-white/10 transition-colors shrink-0"
        >
          {menuAbierto ? (
            <span className="text-2xl leading-none">×</span>
          ) : (
            <span className="flex flex-col gap-1">
              <span className="block w-5 h-0.5 bg-white rounded" />
              <span className="block w-5 h-0.5 bg-white rounded" />
              <span className="block w-5 h-0.5 bg-white rounded" />
            </span>
          )}
        </button>
      </div>

      {/* ============================================================
          Panel desplegable — hasta xl
          ============================================================ */}
      {menuAbierto && (
        <div className="xl:hidden border-t border-white/10 bg-verde-hondo">
          <div className="px-4 py-3 space-y-4">

            {/* Secciones: solo si no están en la fila principal (< sm) */}
            <nav className="sm:hidden flex flex-col gap-1">
              {visibles.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  onClick={() => setMenuAbierto(false)}
                  aria-current={esActiva(s.href) ? 'page' : undefined}
                  className={`px-3 py-2.5 rounded text-sm transition ${
                    esActiva(s.href)
                      ? 'bg-white/15 text-white font-medium'
                      : 'text-tiza hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </nav>

            {/* Identidad y sucursal: no están en la fila principal por
                debajo de xl */}
            <div className="flex items-center justify-between
                            border-t border-white/10 pt-3 sm:border-t-0 sm:pt-0">
              <div className="text-xs leading-tight">
                <div className="font-medium text-white">{nombreCompleto}</div>
                <div className="text-tiza/70">
                  {rol} · {sucursalNombre}
                </div>
              </div>
              <SelectorSucursal
                sucursalActual={sucursalId}
                sucursales={sucursalesAutorizadas}
              />
            </div>

            <div className="flex gap-4 border-t border-white/10 pt-3 text-sm">
              <Link
                href="/cuenta"
                onClick={() => setMenuAbierto(false)}
                className="text-tiza hover:text-white transition-colors"
              >
                Mi cuenta
              </Link>
              <button
                onClick={salir}
                className="text-tiza hover:text-white transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}