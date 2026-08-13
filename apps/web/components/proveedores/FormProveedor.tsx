'use client';

import { useActionState, useTransition } from 'react';
import Link from 'next/link';
import {
  guardarProveedor,
  alternarActivoProveedor,
  type EstadoForm,
} from '@/app/(app)/proveedores/acciones';

interface Proveedor {
  id: string;
  nombre: string;
  codigo_proveedor: string;
  cuit: string | null;
  contacto: string | null;
  vendedor: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  condiciones_pago: string | null;
  dias_visita: string | null;
  observaciones: string | null;
  activo: boolean;
}

export function FormProveedor({ proveedor }: { proveedor?: Proveedor }) {
  const [estado, accion, guardando] = useActionState<EstadoForm, FormData>(
    guardarProveedor,
    {},
  );
  const [pendiente, startTransition] = useTransition();

  return (
    <form action={accion} className="max-w-2xl space-y-5">
      {proveedor && <input type="hidden" name="id" value={proveedor.id} />}

      {/* --- Datos principales --- */}
      <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
        <h2 className="text-sm font-medium">Datos del proveedor</h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Campo label="Nombre" error={campoError(estado, 'nombre')}>
              <input
                name="nombre"
                defaultValue={proveedor?.nombre}
                required
                autoFocus
                placeholder="Distribuidora del Valle"
                className="input"
              />
            </Campo>
          </div>

          <Campo
            label="Código"
            error={campoError(estado, 'codigoProveedor')}
            ayuda="Para uso interno"
          >
            <input
              name="codigoProveedor"
              defaultValue={proveedor?.codigo_proveedor}
              required
              placeholder="DVALLE"
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
              className="input num"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="CUIT">
            <input
              name="cuit"
              defaultValue={proveedor?.cuit ?? ''}
              placeholder="30-12345678-9"
              className="input num"
            />
          </Campo>

          <Campo label="Condiciones de pago" ayuda="Contado, 30 días, 30/60…">
            <input
              name="condicionesPago"
              defaultValue={proveedor?.condiciones_pago ?? ''}
              className="input"
            />
          </Campo>
        </div>
      </section>

      {/* --- Contacto --- */}
      <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
        <h2 className="text-sm font-medium">Contacto</h2>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Vendedor" ayuda="El viajante que te atiende">
            <input
              name="vendedor"
              defaultValue={proveedor?.vendedor ?? ''}
              className="input"
            />
          </Campo>

          <Campo label="Teléfono">
            <input
              name="telefono"
              defaultValue={proveedor?.telefono ?? ''}
              className="input num"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Días de visita" ayuda="Martes y viernes, quincenal…">
            <input
              name="diasVisita"
              defaultValue={proveedor?.dias_visita ?? ''}
              className="input"
            />
          </Campo>

          <Campo label="Email" error={campoError(estado, 'email')}>
            <input
              name="email"
              type="email"
              defaultValue={proveedor?.email ?? ''}
              className="input"
            />
          </Campo>
        </div>

        <Campo label="Otro contacto" ayuda="Administración, depósito…">
          <input
            name="contacto"
            defaultValue={proveedor?.contacto ?? ''}
            className="input"
          />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Dirección">
            <input
              name="direccion"
              defaultValue={proveedor?.direccion ?? ''}
              className="input"
            />
          </Campo>

          <Campo label="Localidad">
            <input
              name="localidad"
              defaultValue={proveedor?.localidad ?? ''}
              className="input"
            />
          </Campo>
        </div>

        <Campo label="Observaciones" ayuda="Pedido mínimo, zona de reparto…">
          <input
            name="observaciones"
            defaultValue={proveedor?.observaciones ?? ''}
            className="input"
          />
        </Campo>
      </section>

      {estado.error && !estado.campo && (
        <p className="text-sm text-rojo-plomo">{estado.error}</p>
      )}

      <div className="flex items-center gap-2 justify-end">
        {proveedor && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              startTransition(() => {
                void alternarActivoProveedor(proveedor.id, !proveedor.activo);
              })
            }
            className="mr-auto text-xs text-verde-claro hover:text-rojo-plomo"
          >
            {proveedor.activo ? 'Dar de baja' : 'Reactivar'}
          </button>
        )}

        <Link
          href="/proveedores"
          className="px-4 py-2.5 text-sm rounded-lg ring-1 ring-tiza/60 bg-mostrador"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={guardando}
          className="px-5 py-2.5 text-sm rounded-lg bg-verde-esmalte text-white
                     font-medium disabled:opacity-40"
        >
          {guardando
            ? 'Guardando…'
            : proveedor
              ? 'Guardar cambios'
              : 'Crear proveedor'}
        </button>
      </div>
    </form>
  );
}

function campoError(estado: EstadoForm, campo: string) {
  return estado.campo === campo ? estado.error : undefined;
}

function Campo({
  label,
  ayuda,
  error,
  children,
}: {
  label: string;
  ayuda?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-verde-claro mb-1">{label}</span>
      {children}
      {ayuda && !error && (
        <span className="block text-xs text-verde-claro/70 mt-1">{ayuda}</span>
      )}
      {error && (
        <span className="block text-xs text-rojo-plomo mt-1">{error}</span>
      )}
    </label>
  );
}