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
  { href: '/admin', label: 'Administración', roles: ['admin'] },
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
    <header className="bg-verde-esmalte sticky top-0 z-30 shadow-sm">
      {/* ============================================================
          Fila principal — ancho completo de la ventana, sin el
          max-w-6xl que antes achicaba la barra y forzaba un scroll
          horizontal feo apenas se agregaba más espaciado. El
          contenido de abajo (<main>) sigue limitado a max-w-6xl
          para que se lea cómodo; la barra de navegación no necesita
          esa restricción.
          ============================================================ */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-14 lg:h-16
                      flex items-center gap-3 sm:gap-5 lg:gap-8">
        <Link
          href="/caja"
          className="font-black tracking-tight text-white whitespace-nowrap
                     hover:text-tiza transition-colors text-base lg:text-lg"
        >
          NAVARRETE
        </Link>

        {/* Secciones: fila horizontal solo en pantallas medianas o más.
            Sin ancho artificial de por medio, entran cómodas incluso
            con más padding entre ellas. */}
        <nav className="hidden sm:flex gap-1 lg:gap-2 flex-1">
          {visibles.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              aria-current={esActiva(s.href) ? 'page' : undefined}
              className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-md text-sm
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

        {/* En celular, este espacio empuja el resto a la derecha */}
        <div className="flex-1 sm:hidden" />

        {/* Bloque de la derecha: separado del resto con un borde */}
        <div className="flex items-center gap-4 lg:gap-6 lg:border-l lg:border-white/15 lg:pl-6 shrink-0">
          <BotonChat ctx={{ usuarioId, nombreUsuario: nombre, sucursalId }} />

          <div className="hidden lg:block text-right text-xs leading-tight">
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

          <div className="hidden lg:flex items-center gap-4">
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

        {/* Hamburguesa: solo hasta el breakpoint lg */}
        <button
          onClick={() => setMenuAbierto((a) => !a)}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded
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
          Panel desplegable — hasta el breakpoint lg
          ============================================================ */}
      {menuAbierto && (
        <div className="lg:hidden border-t border-white/10 bg-verde-hondo">
          <div className="px-4 py-3 space-y-4">

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

            <div className="lg:hidden flex items-center justify-between
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