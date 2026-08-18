'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  guardarSucursal,
  type EstadoForm,
} from '@/app/(app)/admin/sucursales/acciones';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { ReglaRedondeo } from '@pos/shared/types';

const REDONDEOS: { valor: ReglaRedondeo; label: string; ejemplo: string }[] = [
  { valor: 'sin_redondeo', label: 'Sin redondeo', ejemplo: '3.617,40' },
  { valor: 'al_peso', label: 'Al peso entero', ejemplo: '3.617' },
  { valor: 'al_cincuenta', label: 'A .00 o .50', ejemplo: '3.617,50' },
  { valor: 'a_la_decena', label: 'A la decena', ejemplo: '3.620' },
  { valor: 'a_la_centena', label: 'A la centena', ejemplo: '3.600' },
];

interface Sucursal {
  id: string;
  nombre: string;
  codigo: string;
  punto_venta: number;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
  regla_redondeo: ReglaRedondeo;
  margen_default: number;
  umbral_diferencia_caja: number | null;
  dias_retencion_local: number | null;
}

export function FormSucursal({ sucursal }: { sucursal?: Sucursal }) {
  const [estado, accion, pendiente] = useActionState<EstadoForm, FormData>(
    guardarSucursal,
    {},
  );

  const [regla, setRegla] = useState<ReglaRedondeo>(
    sucursal?.regla_redondeo ?? 'al_peso',
  );
  const [umbral, setUmbral] = useState(
    Number(sucursal?.umbral_diferencia_caja ?? 500),
  );

  return (
    <form action={accion} className="max-w-2xl space-y-6">
      {sucursal && <input type="hidden" name="id" value={sucursal.id} />}

      {/* --- Identificación --- */}
      <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
        <h2 className="text-sm font-medium">Identificación</h2>

        <Campo label="Nombre" error={campoError(estado, 'nombre')}>
          <input
            name="nombre"
            defaultValue={sucursal?.nombre}
            required
            autoFocus
            className="input"
          />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo
            label="Código"
            error={campoError(estado, 'codigo')}
            ayuda="Aparece en el número de factura: SUC01-20260813-000147"
          >
            <input
              name="codigo"
              defaultValue={sucursal?.codigo}
              required
              placeholder="SUC01"
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
              }}
              className="input num"
            />
          </Campo>

          <Campo
            label="Punto de venta"
            error={campoError(estado, 'puntoVenta')}
            ayuda="Uno por caja. Dos cajas con el mismo número duplican remitos."
          >
            <input
              name="puntoVenta"
              type="number"
              min="1"
              step="1"
              defaultValue={sucursal?.punto_venta ?? 1}
              required
              className="input num text-right"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Ciudad">
            <input
              name="ciudad"
              defaultValue={sucursal?.ciudad ?? ''}
              className="input"
            />
          </Campo>
          <Campo label="Teléfono">
            <input
              name="telefono"
              defaultValue={sucursal?.telefono ?? ''}
              className="input"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Dirección">
            <input
              name="direccion"
              defaultValue={sucursal?.direccion ?? ''}
              className="input"
            />
          </Campo>
          <Campo label="Zona" ayuda="Para agrupar en reportes">
            <input
              name="zona"
              defaultValue={sucursal?.zona ?? ''}
              className="input"
            />
          </Campo>
        </div>
      </section>

      {/* --- Operación --- */}
      <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
        <h2 className="text-sm font-medium">Operación</h2>

        <Campo
          label="Redondeo de precios"
          ayuda="Se aplica al calcular el precio de venta de cada artículo"
        >
          <div className="space-y-1.5">
            {REDONDEOS.map((r) => (
              <label
                key={r.valor}
                className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                  regla === r.valor
                    ? 'border-verde-esmalte bg-papel'
                    : 'border-tiza hover:border-verde-claro'
                }`}
              >
                <input
                  type="radio"
                  name="reglaRedondeo"
                  value={r.valor}
                  checked={regla === r.valor}
                  onChange={() => setRegla(r.valor)}
                  className="accent-verde-esmalte"
                />
                <span className="flex-1 text-sm">{r.label}</span>
                <span className="num text-sm text-verde-claro">
                  $ {r.ejemplo}
                </span>
              </label>
            ))}
          </div>
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo
            label="Margen por defecto (%)"
            ayuda="Se propone al crear un artículo"
          >
            <input
              name="margenDefault"
              type="number"
              step="0.01"
              min="0"
              defaultValue={Number(sucursal?.margen_default ?? 30)}
              className="input num text-right"
            />
          </Campo>

          <Campo
            label="Días de historial en el dispositivo"
            ayuda="Las ventas más viejas se borran del celular, no del servidor"
          >
            <input
              name="diasRetencionLocal"
              type="number"
              min="7"
              max="365"
              step="1"
              defaultValue={Number(sucursal?.dias_retencion_local ?? 45)}
              className="input num text-right"
            />
          </Campo>
        </div>

        <Campo label="Umbral de diferencia de caja">
          <input
            name="umbralDiferencia"
            type="number"
            step="0.01"
            min="0"
            value={umbral}
            onChange={(e) => setUmbral(Number(e.target.value))}
            className="input num text-right"
          />
          <p className="text-xs text-verde-claro mt-1.5">
            Al cerrar caja, una diferencia mayor a{' '}
            {formatearPrecio(umbral)} pide justificación escrita.
            Si salta todos los días está muy bajo; si nunca salta, muy alto.
          </p>
        </Campo>
      </section>

      {estado.error && !estado.campo && (
        <p className="text-sm text-rojo-plomo">{estado.error}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Link
          href="/admin/sucursales"
          className="px-4 py-2.5 text-sm rounded-lg ring-1 ring-tiza/60 bg-mostrador"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pendiente}
          className="px-5 py-2.5 text-sm rounded-lg bg-verde-esmalte text-white
                     font-medium disabled:opacity-40"
        >
          {pendiente
            ? 'Guardando…'
            : sucursal
              ? 'Guardar cambios'
              : 'Crear sucursal'}
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