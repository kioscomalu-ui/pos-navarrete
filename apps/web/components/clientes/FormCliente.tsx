'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { guardarCliente, type EstadoForm } from '@/app/(app)/clientes/acciones';

interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  zona: string | null;
  limite_credito: number;
}

export function FormCliente({ cliente }: { cliente?: Cliente }) {
  const [estado, accion, guardando] = useActionState<EstadoForm, FormData>(
    guardarCliente,
    {},
  );

  return (
    <form action={accion} className="max-w-lg space-y-5">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
        <Campo label="Nombre" error={campoError(estado, 'nombre')}>
          <input
            name="nombre"
            defaultValue={cliente?.nombre}
            required
            autoFocus
            className="input"
          />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Teléfono">
            <input
              name="telefono"
              defaultValue={cliente?.telefono ?? ''}
              className="input num"
            />
          </Campo>

          <Campo label="Zona" ayuda="Para agrupar en la ruta del cobrador">
            <input
              name="zona"
              defaultValue={cliente?.zona ?? ''}
              className="input"
            />
          </Campo>
        </div>

        <Campo label="Dirección">
          <input
            name="direccion"
            defaultValue={cliente?.direccion ?? ''}
            className="input"
          />
        </Campo>

        <Campo
          label="Límite de crédito"
          ayuda="0 significa sin límite fijo"
          error={campoError(estado, 'limiteCredito')}
        >
          <input
            name="limiteCredito"
            type="number"
            step="0.01"
            min="0"
            defaultValue={Number(cliente?.limite_credito ?? 0)}
            className="input num text-right"
          />
        </Campo>

        {!cliente && (
          <Campo
            label="Saldo inicial"
            ayuda="Solo si viene con una deuda arrastrada de otro sistema"
          >
            <input
              name="saldoInicial"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              className="input num text-right"
            />
          </Campo>
        )}
      </section>

      {estado.error && !estado.campo && (
        <p className="text-sm text-rojo-plomo">{estado.error}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Link
          href="/clientes"
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
            : cliente
              ? 'Guardar cambios'
              : 'Crear cliente'}
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