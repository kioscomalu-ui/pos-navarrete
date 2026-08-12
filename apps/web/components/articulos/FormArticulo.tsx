'use client';

import { useActionState, useState, useMemo } from 'react';
import { calcularPrecio, calcularMargen } from '@pos/shared/utils/calcular-precio';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import { guardarArticulo, type EstadoForm } from '@/app/(app)/articulos/acciones';
import type { MargenTipo, ReglaRedondeo, UnidadMedida } from '@pos/shared/types';

interface Props {
  articulo?: {
    id: string;
    codigo_barras: string | null;
    codigo_interno: string | null;
    nombre: string;
    categoria_id: string | null;
    unidad: UnidadMedida;
    costo_unitario: number;
    margen_tipo: MargenTipo;
    margen_valor: number;
    stock_minimo: number;
    proveedor_principal_id: string | null;
  };
  categorias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  reglaDefault: ReglaRedondeo;
}

export function FormArticulo({ articulo, categorias, proveedores, reglaDefault }: Props) {
  const [estado, accion, pendiente] = useActionState<EstadoForm, FormData>(
    guardarArticulo,
    {},
  );

  const [costo, setCosto] = useState(articulo?.costo_unitario ?? 0);
  const [margenTipo, setMargenTipo] = useState<MargenTipo>(articulo?.margen_tipo ?? 'porcentaje');
  const [margenValor, setMargenValor] = useState(articulo?.margen_valor ?? 30);
  const [regla, setRegla] = useState<ReglaRedondeo>(reglaDefault);

  const precio = useMemo(
    () => calcularPrecio({ costoUnitario: costo, margenTipo, margenValor, reglaRedondeo: regla }),
    [costo, margenTipo, margenValor, regla],
  );

  const margenReal = useMemo(
    () => calcularMargen(costo, precio.precioFinal),
    [costo, precio.precioFinal],
  );

  return (
    <form action={accion} className="grid grid-cols-[1fr_280px] gap-8 items-start">
      {articulo && <input type="hidden" name="id" value={articulo.id} />}

      {/* --- Datos del artículo --- */}
      <div className="space-y-4">
        <Campo label="Nombre" error={estado.campo === 'nombre' ? estado.error : undefined}>
          <input
            name="nombre"
            defaultValue={articulo?.nombre}
            autoFocus
            required
            className="input"
          />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo
            label="Código de barras"
            error={estado.campo === 'codigoBarras' ? estado.error : undefined}
          >
            <input
              name="codigoBarras"
              defaultValue={articulo?.codigo_barras ?? ''}
              placeholder="Escanear o escribir"
              className="input font-mono"
            />
          </Campo>

          <Campo label="Código interno">
            <input
              name="codigoInterno"
              defaultValue={articulo?.codigo_interno ?? ''}
              className="input font-mono"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Categoría">
            <select name="categoriaId" defaultValue={articulo?.categoria_id ?? ''} className="input">
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Campo>

          <Campo label="Unidad de venta">
            <select name="unidad" defaultValue={articulo?.unidad ?? 'unidad'} className="input">
              <option value="unidad">Por unidad</option>
              <option value="kg">Por kilogramo</option>
              <option value="litro">Por litro</option>
              <option value="metro">Por metro</option>
            </select>
          </Campo>
        </div>

        <Campo label="Proveedor principal">
          <select
            name="proveedorId"
            defaultValue={articulo?.proveedor_principal_id ?? ''}
            className="input"
          >
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </Campo>

        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-neutral-200">
          <Campo label="Costo unitario">
            <input
              name="costoUnitario"
              type="number"
              step="0.01"
              min="0"
              value={costo}
              onChange={(e) => setCosto(Number(e.target.value))}
              required
              className="input font-mono text-right"
            />
          </Campo>

          <Campo label="Tipo de margen">
            <select
              name="margenTipo"
              value={margenTipo}
              onChange={(e) => setMargenTipo(e.target.value as MargenTipo)}
              className="input"
            >
              <option value="porcentaje">Porcentaje</option>
              <option value="importe">Importe fijo</option>
            </select>
          </Campo>

          <Campo label={margenTipo === 'porcentaje' ? 'Margen (%)' : 'Margen ($)'}>
            <input
              name="margenValor"
              type="number"
              step="0.01"
              value={margenValor}
              onChange={(e) => setMargenValor(Number(e.target.value))}
              required
              className="input font-mono text-right"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Redondeo">
            <select
              name="reglaRedondeo"
              value={regla}
              onChange={(e) => setRegla(e.target.value as ReglaRedondeo)}
              className="input"
            >
              <option value="sin_redondeo">Sin redondeo</option>
              <option value="al_peso">Al peso entero</option>
              <option value="al_cincuenta">A .00 o .50</option>
              <option value="a_la_decena">A la decena</option>
            </select>
          </Campo>

          <Campo label="Stock mínimo">
            <input
              name="stockMinimo"
              type="number"
              step="0.001"
              min="0"
              defaultValue={articulo?.stock_minimo ?? 0}
              className="input font-mono text-right"
            />
          </Campo>
        </div>
      </div>

      {/* --- Panel de precio --- */}
      <aside className="sticky top-6 bg-white border border-neutral-200 rounded p-5 space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-neutral-500">
          Precio calculado
        </h2>

        <dl className="font-mono text-sm space-y-1.5">
          <Fila etiqueta="Costo" valor={formatearPrecio(costo)} />
          <Fila
            etiqueta={margenTipo === 'porcentaje' ? `+ ${margenValor}%` : `+ $${margenValor}`}
            valor={formatearPrecio(precio.precioBase - costo)}
          />
          <Fila etiqueta="Base" valor={formatearPrecio(precio.precioBase)} />
          <Fila
            etiqueta="Redondeo"
            valor={
              (precio.redondeoAplicado >= 0 ? '+' : '') +
              formatearPrecio(precio.redondeoAplicado)
            }
          />
        </dl>

        <div className="border-t border-neutral-200 pt-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-neutral-500">Precio final</span>
            <span className="text-2xl font-mono font-semibold">
              {formatearPrecio(precio.precioFinal)}
            </span>
          </div>
          <p
            className={`text-xs mt-1 text-right ${
              margenReal.porcentaje < 10 ? 'text-red-600' : 'text-neutral-500'
            }`}
          >
            margen real {margenReal.porcentaje}%
          </p>
        </div>

        {estado.error && !estado.campo && (
          <p className="text-sm text-red-600">{estado.error}</p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="w-full py-2.5 bg-neutral-900 text-white rounded font-medium disabled:opacity-40"
        >
          {pendiente ? 'Guardando…' : articulo ? 'Guardar cambios' : 'Crear artículo'}
        </button>
      </aside>
    </form>
  );
}

function Campo({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between text-neutral-600">
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}