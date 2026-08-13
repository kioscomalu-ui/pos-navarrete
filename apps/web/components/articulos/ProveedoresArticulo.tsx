'use client';

import { useEffect, useState, useTransition } from 'react';
import { supabase } from '@/lib/supabase';
import {
  guardarProveedorArticulo,
  quitarProveedorArticulo,
  definirPrincipal,
} from '@/app/(app)/articulos/proveedores-acciones';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface FilaProveedor {
  id: string;
  proveedor_id: string;
  proveedor: string;
  codigo_proveedor: string | null;
  presentacion: string | null;
  costo: number;
  plazo_entrega: number | null;
  observaciones: string | null;
  activo: boolean;
  es_principal: boolean;
  ultimo_cambio: string | null;
  variacion_pct: number | null;
  es_mas_barato: boolean;
}

interface Props {
  articuloId: string;
  proveedores: { id: string; nombre: string }[];
}

export function ProveedoresArticulo({ articuloId, proveedores }: Props) {
  const [filas, setFilas] = useState<FilaProveedor[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [pendiente, startTransition] = useTransition();

  async function cargar() {
    const { data } = await supabase.rpc('proveedores_de_articulo', {
      p_articulo_id: articuloId,
    });
    setFilas((data ?? []) as FilaProveedor[]);
  }

  useEffect(() => {
    void cargar();
  }, [articuloId]);

  const yaCargados = new Set(filas.map((f) => f.proveedor_id));
  const disponibles = proveedores.filter((p) => !yaCargados.has(p.id));

  return (
    <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Proveedores</h2>
          <p className="text-xs text-verde-claro mt-0.5">
            El código de cada proveedor sirve para identificar el artículo
            cuando llega su factura.
          </p>
        </div>

        {disponibles.length > 0 && !agregando && (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="text-sm text-verde-claro hover:text-verde-esmalte"
          >
            Agregar proveedor
          </button>
        )}
      </div>

      {mensaje && (
        <p className="text-xs bg-papel rounded px-3 py-2">{mensaje}</p>
      )}

      {/* Lista */}
      {filas.length === 0 && !agregando && (
        <p className="text-sm text-verde-claro/70 py-6 text-center">
          Todavía no cargaste proveedores para este artículo
        </p>
      )}

      <div className="space-y-2">
        {filas.map((f) =>
          editando === f.proveedor_id ? (
            <FormProveedor
              key={f.id}
              articuloId={articuloId}
              proveedores={proveedores}
              inicial={f}
              onListo={async () => {
                setEditando(null);
                await cargar();
              }}
              onCancelar={() => setEditando(null)}
            />
          ) : (
            <div
              key={f.id}
              className={`rounded border p-3 ${
                !f.activo
                  ? 'border-tiza/40 opacity-50'
                  : f.es_principal
                    ? 'border-verde-esmalte bg-papel'
                    : 'border-tiza/60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{f.proveedor}</span>

                    {f.es_principal && (
                      <span className="text-[0.65rem] uppercase tracking-wide
                                       bg-verde-esmalte text-white px-1.5 py-0.5 rounded">
                        principal
                      </span>
                    )}

                    {f.es_mas_barato && !f.es_principal && (
                      <span className="text-[0.65rem] uppercase tracking-wide
                                       bg-ambar-dial text-verde-hondo px-1.5 py-0.5 rounded">
                        más barato
                      </span>
                    )}

                    {!f.activo && (
                      <span className="text-xs text-verde-claro">inactivo</span>
                    )}
                  </div>

                  <div className="text-xs text-verde-claro mt-1 space-x-3">
                    {f.codigo_proveedor && (
                      <span>
                        código <span className="num">{f.codigo_proveedor}</span>
                      </span>
                    )}
                    {f.presentacion && <span>{f.presentacion}</span>}
                    {f.plazo_entrega != null && (
                      <span>
                        entrega en <span className="num">{f.plazo_entrega}</span> días
                      </span>
                    )}
                  </div>

                  {f.observaciones && (
                    <p className="text-xs text-verde-claro/70 mt-1">
                      {f.observaciones}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="num font-medium">
                    {formatearPrecio(Number(f.costo))}
                  </div>

                  {f.variacion_pct != null && (
                    <div
                      className={`num text-xs mt-0.5 ${
                        Number(f.variacion_pct) > 0
                          ? 'text-rojo-plomo'
                          : 'text-verde-ok'
                      }`}
                    >
                      {Number(f.variacion_pct) > 0 ? '+' : ''}
                      {Number(f.variacion_pct)}% último cambio
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-3 pt-2 border-t border-tiza/40 text-xs">
                <button
                  type="button"
                  onClick={() => setEditando(f.proveedor_id)}
                  className="text-verde-claro hover:text-verde-esmalte"
                >
                  Editar
                </button>

                {!f.es_principal && f.activo && (
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await definirPrincipal(
                          articuloId,
                          f.proveedor_id,
                          true,
                        );
                        setMensaje(
                          r.error ??
                            `${f.proveedor} es el proveedor principal. El costo del artículo se actualizó a ${formatearPrecio(Number(f.costo))}.`,
                        );
                        await cargar();
                      })
                    }
                    className="text-verde-claro hover:text-verde-esmalte"
                  >
                    Usar como principal
                  </button>
                )}

                {f.activo && !f.es_principal && (
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() =>
                      startTransition(async () => {
                        await quitarProveedorArticulo(articuloId, f.proveedor_id);
                        await cargar();
                      })
                    }
                    className="text-verde-claro hover:text-rojo-plomo ml-auto"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ),
        )}

        {agregando && (
          <FormProveedor
            articuloId={articuloId}
            proveedores={disponibles}
            onListo={async () => {
              setAgregando(false);
              await cargar();
            }}
            onCancelar={() => setAgregando(false)}
          />
        )}
      </div>

      {filas.filter((f) => f.activo).length > 1 && (
        <p className="text-xs text-verde-claro/70 pt-2 border-t border-tiza/40">
          El costo del artículo y su precio de venta salen del proveedor
          principal. Cambiarlo recalcula el precio con el mismo margen.
        </p>
      )}
    </section>
  );
}

// --------------------------------------------------------------

function FormProveedor({
  articuloId,
  proveedores,
  inicial,
  onListo,
  onCancelar,
}: {
  articuloId: string;
  proveedores: { id: string; nombre: string }[];
  inicial?: FilaProveedor;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const [proveedorId, setProveedorId] = useState(
    inicial?.proveedor_id ?? proveedores[0]?.id ?? '',
  );
  const [codigo, setCodigo] = useState(inicial?.codigo_proveedor ?? '');
  const [presentacion, setPresentacion] = useState(inicial?.presentacion ?? '');
  const [costo, setCosto] = useState(String(inicial?.costo ?? ''));
  const [plazo, setPlazo] = useState(String(inicial?.plazo_entrega ?? ''));
  const [obs, setObs] = useState(inicial?.observaciones ?? '');
  const [error, setError] = useState('');
  const [pendiente, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const r = await guardarProveedorArticulo({
        articuloId,
        proveedorId,
        codigoProveedor: codigo,
        presentacion,
        costo: Number(costo.replace(',', '.')),
        plazoEntrega: plazo ? Number(plazo) : undefined,
        observaciones: obs,
      });

      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <div className="rounded border-2 border-verde-esmalte p-4 space-y-3 bg-papel">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">Proveedor</span>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            disabled={!!inicial}
            className="input"
          >
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">
            Código del proveedor
          </span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="AL-4471"
            className="input num"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">Costo</span>
          <input
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            inputMode="decimal"
            className="input num text-right"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">
            Presentación
          </span>
          <input
            value={presentacion}
            onChange={(e) => setPresentacion(e.target.value)}
            placeholder="caja x 12"
            className="input"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-verde-claro mb-1">
            Entrega (días)
          </span>
          <input
            value={plazo}
            onChange={(e) => setPlazo(e.target.value)}
            type="number"
            min="0"
            className="input num text-right"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs text-verde-claro mb-1">
          Observaciones
        </span>
        <input
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Pedido mínimo 6 unidades"
          className="input"
        />
      </label>

      {error && <p className="text-xs text-rojo-plomo">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancelar}
          className="px-3 py-1.5 text-xs rounded ring-1 ring-tiza"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || !proveedorId || !costo}
          className="px-4 py-1.5 text-xs rounded bg-verde-esmalte text-white
                     disabled:opacity-30"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}