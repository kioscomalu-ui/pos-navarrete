'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calcularPrecio } from '@pos/shared/utils/calcular-precio';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { MargenTipo, ReglaRedondeo } from '@pos/shared/types';

interface Proveedor {
  id: string;
  nombre: string;
}

interface ArticuloCandidato {
  id: string;
  nombre: string;
  codigoProveedor: string | null;
  presentacion: string | null;
  costoAnterior: number | null;
  costoUnitarioActual: number;
  margenTipo: MargenTipo;
  margenValor: number;
  precioManual: boolean;
  precioActual: number;
  proveedorPrincipalId: string | null;
}

interface Renglon extends ArticuloCandidato {
  lineaId: string;
  unidades: string;
  costoBulto: string;
  margen: string;
}

interface Props {
  proveedores: Proveedor[];
  reglaRedondeo: ReglaRedondeo;
}

const CAMPOS_ARTICULO =
  'id, nombre, costo_unitario, margen_tipo, margen_valor, ' +
  'precio_manual, precio_venta_final, proveedor_principal_id';

/** "Caja x 12" → 12. Sirve para no tipear la cantidad cada vez. */
function unidadesDePresentacion(p: string | null): string {
  const m = (p ?? '').match(/(\d+)/);
  return m ? m[1] : '1';
}

function desdeArticulo(a: any): ArticuloCandidato {
  return {
    id: a.id,
    nombre: a.nombre,
    codigoProveedor: null,
    presentacion: null,
    costoAnterior: null,
    costoUnitarioActual: Number(a.costo_unitario),
    margenTipo: a.margen_tipo,
    margenValor: Number(a.margen_valor),
    precioManual: !!a.precio_manual,
    precioActual: Number(a.precio_venta_final ?? 0),
    proveedorPrincipalId: a.proveedor_principal_id,
  };
}

export function FacturaProveedor({ proveedores, reglaRedondeo }: Props) {
  const [proveedorId, setProveedorId] = useState('');
  const [delProveedor, setDelProveedor] = useState<ArticuloCandidato[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  const [termino, setTermino] = useState('');
  const [otros, setOtros] = useState<ArticuloCandidato[]>([]);

  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [totalFactura, setTotalFactura] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');

  // ---- Artículos ya asociados a este proveedor ----
  const cargarDelProveedor = useCallback(async (id: string) => {
    if (!id) {
      setDelProveedor([]);
      return;
    }
    setCargandoLista(true);
    try {
      const { data } = await supabase
        .from('articulos_proveedores')
        .select(
          `articulo_id, codigo_proveedor, costo_proveedor, presentacion, articulos!inner(${CAMPOS_ARTICULO}, activo)`,
        )
        .eq('proveedor_id', id)
        .eq('articulos.activo', true)
        .range(0, 1999);

      setDelProveedor(
        (data ?? []).map((r: any) => ({
          ...desdeArticulo(r.articulos),
          id: r.articulo_id,
          codigoProveedor: r.codigo_proveedor,
          presentacion: r.presentacion,
          costoAnterior:
            r.costo_proveedor != null ? Number(r.costo_proveedor) : null,
        })),
      );
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    void cargarDelProveedor(proveedorId);
    setRenglones([]);
    setOtros([]);
    setTermino('');
    setListo('');
  }, [proveedorId, cargarDelProveedor]);

  const yaPuestos = useMemo(
    () => new Set(renglones.map((r) => r.id)),
    [renglones],
  );

  // ---- Coincidencias entre los del proveedor ----
  const coincidencias = useMemo(() => {
    const t = termino.trim().toLowerCase();
    if (t.length < 2) return [];

    return delProveedor
      .filter(
        (a) =>
          !yaPuestos.has(a.id) &&
          (a.nombre.toLowerCase().includes(t) ||
            (a.codigoProveedor ?? '').toLowerCase().includes(t)),
      )
      .slice(0, 12);
  }, [termino, delProveedor, yaPuestos]);

  // ---- Búsqueda en todo el catálogo, siempre.
  //      Antes solo corría si no había coincidencias del proveedor, y
  //      eso escondía el resto del catálogo apenas una coincidía. ----
  useEffect(() => {
    const t = termino.trim();
    if (t.length < 2) {
      setOtros([]);
      return;
    }

    let cancelado = false;
    const id = setTimeout(async () => {
      const { data } = await supabase
        .from('articulos')
        .select(CAMPOS_ARTICULO)
        .eq('activo', true)
        .ilike('nombre', `%${t}%`)
        .limit(15);

      if (cancelado) return;

      const delProveedorIds = new Set(delProveedor.map((a) => a.id));
      setOtros(
        (data ?? [])
          .filter((a: any) => !yaPuestos.has(a.id) && !delProveedorIds.has(a.id))
          .map(desdeArticulo),
      );
    }, 250);

    return () => {
      cancelado = true;
      clearTimeout(id);
    };
  }, [termino, delProveedor, yaPuestos]);

  function agregar(a: ArticuloCandidato) {
    setRenglones((rs) => [
      ...rs,
      {
        ...a,
        lineaId: crypto.randomUUID(),
        unidades: unidadesDePresentacion(a.presentacion),
        costoBulto: '',
        margen: String(a.margenValor),
      },
    ]);
    setTermino('');
    setOtros([]);
    setListo('');
  }

  function actualizar(
    lineaId: string,
    campo: 'unidades' | 'costoBulto' | 'margen',
    valor: string,
  ) {
    setRenglones((rs) =>
      rs.map((r) => (r.lineaId === lineaId ? { ...r, [campo]: valor } : r)),
    );
    setListo('');
  }

  function quitar(lineaId: string) {
    setRenglones((rs) => rs.filter((r) => r.lineaId !== lineaId));
  }

  // ---- Cálculo por renglón ----
  const calculados = renglones.map((r) => {
    const unidades = Number(r.unidades.replace(',', '.')) || 0;
    const bulto = Number(r.costoBulto.replace(',', '.')) || 0;
    const costoUnitario =
      unidades > 0 && bulto > 0 ? Math.round((bulto / unidades) * 100) / 100 : 0;

    const margenValor = Number(r.margen.replace(',', '.')) || 0;

    const precio = calcularPrecio({
      costoUnitario,
      margenTipo: r.margenTipo,
      margenValor,
      reglaRedondeo,
    });

    const base = r.costoAnterior ?? r.costoUnitarioActual;
    const variacion =
      base > 0 && costoUnitario > 0
        ? Math.round(((costoUnitario - base) / base) * 1000) / 10
        : null;

    // Solo el proveedor principal define el costo y el precio del
    // artículo. Desde otro proveedor se registra su costo, nada más.
    const esPrincipal =
      !r.proveedorPrincipalId || r.proveedorPrincipalId === proveedorId;

    return {
      renglon: r,
      costoUnitario,
      margenValor,
      precio,
      variacion,
      bulto,
      esPrincipal,
      valido: costoUnitario > 0,
    };
  });

  const sumaRenglones = calculados.reduce((a, c) => a + c.bulto, 0);
  const nTotalFactura = Number(totalFactura.replace(',', '.')) || 0;
  const diferenciaTotal =
    nTotalFactura > 0 ? Math.round((sumaRenglones - nTotalFactura) * 100) / 100 : 0;

  const hayInvalidos = calculados.some((c) => !c.valido);
  const puedeConfirmar =
    !!proveedorId && calculados.length > 0 && !hayInvalidos && !guardando;

  async function confirmar() {
    setError('');
    setGuardando(true);
    try {
      const items = calculados.map((c) => ({
        articuloId: c.renglon.id,
        costoUnitario: c.costoUnitario,
        margenValor: c.esPrincipal ? c.margenValor : null,
        precioBase: c.precio.precioBase,
        redondeo: c.precio.redondeoAplicado,
        precioFinal: c.precio.precioFinal,
        presentacion: c.renglon.presentacion ?? '',
      }));

      const { data, error: err } = await supabase.rpc('aplicar_factura_proveedor', {
        p_proveedor_id: proveedorId,
        p_items: items,
      });

      if (err) throw new Error(err.message);

      setListo(`${data ?? items.length} artículos actualizados`);
      setRenglones([]);
      setTotalFactura('');
      void cargarDelProveedor(proveedorId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron aplicar los cambios');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-5 space-y-4">
        <label className="block max-w-sm">
          <span className="block text-xs text-verde-claro mb-1">Proveedor</span>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="input"
          >
            <option value="">Elegí un proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        {proveedorId && (
          <div className="relative">
            <label className="block">
              <span className="block text-xs text-verde-claro mb-1">
                Agregar artículo
              </span>
              <input
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                placeholder={
                  cargandoLista
                    ? 'Cargando artículos del proveedor…'
                    : 'Buscar por nombre o código del proveedor…'
                }
                className="input"
              />
            </label>

            {(coincidencias.length > 0 || otros.length > 0) && (
              <ul
                className="absolute z-20 left-0 right-0 mt-1 bg-mostrador rounded-lg
                           ring-1 ring-tiza/60 shadow-lg max-h-80 overflow-y-auto
                           divide-y divide-tiza/40"
              >
                {coincidencias.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => agregar(a)}
                      className="w-full text-left px-4 py-2.5 hover:bg-papel"
                    >
                      <div className="text-sm">{a.nombre}</div>
                      <div className="text-xs text-verde-claro num">
                        {a.codigoProveedor && `${a.codigoProveedor} · `}
                        {a.costoAnterior != null
                          ? `costo ${formatearPrecio(a.costoAnterior)}`
                          : 'sin costo cargado'}
                        {a.presentacion && (
                          <span className="font-sans"> · {a.presentacion}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}

                {otros.length > 0 && (
                  <li className="px-4 py-1.5 bg-papel text-xs text-verde-claro">
                    Todavía no están asociados a este proveedor
                  </li>
                )}

                {otros.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => agregar(a)}
                      className="w-full text-left px-4 py-2.5 hover:bg-papel"
                    >
                      <div className="text-sm">{a.nombre}</div>
                      <div className="text-xs text-verde-claro num">
                        costo actual {formatearPrecio(a.costoUnitarioActual)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {calculados.length > 0 && (
        <>
          <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[52rem]">
                <thead className="bg-papel text-verde-claro text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-3 py-2.5">Artículo</th>
                    <th className="text-right font-medium px-3 py-2.5 w-24">Unidades</th>
                    <th className="text-right font-medium px-3 py-2.5 w-32">Costo bulto</th>
                    <th className="text-right font-medium px-3 py-2.5">Costo unit.</th>
                    <th className="text-right font-medium px-3 py-2.5">Var.</th>
                    <th className="text-right font-medium px-3 py-2.5 w-24">Margen</th>
                    <th className="text-right font-medium px-3 py-2.5">Precio venta</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-tiza/40">
                  {calculados.map((c) => (
                    <tr key={c.renglon.lineaId}>
                      <td className="px-3 py-2.5">
                        <div>{c.renglon.nombre}</div>
                        <div className="text-xs text-verde-claro num">
                          antes{' '}
                          {formatearPrecio(
                            c.renglon.costoAnterior ?? c.renglon.costoUnitarioActual,
                          )}
                          {c.renglon.precioManual && c.esPrincipal && (
                            <span className="font-sans text-ambar-dial">
                              {' '}
                              · precio fijado a mano
                            </span>
                          )}
                          {!c.esPrincipal && (
                            <span className="font-sans text-ambar-dial">
                              {' '}
                              · no es el proveedor principal
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <input
                          value={c.renglon.unidades}
                          onChange={(e) =>
                            actualizar(c.renglon.lineaId, 'unidades', e.target.value)
                          }
                          inputMode="decimal"
                          className="input num text-right py-1.5"
                        />
                      </td>

                      <td className="px-3 py-2.5">
                        <input
                          value={c.renglon.costoBulto}
                          onChange={(e) =>
                            actualizar(c.renglon.lineaId, 'costoBulto', e.target.value)
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="input num text-right py-1.5"
                        />
                      </td>

                      <td className="px-3 py-2.5 text-right num font-medium">
                        {c.valido ? formatearPrecio(c.costoUnitario) : '—'}
                      </td>

                      <td
                        className={`px-3 py-2.5 text-right num ${
                          c.variacion == null
                            ? 'text-verde-claro'
                            : c.variacion > 0
                              ? 'text-rojo-plomo'
                              : 'text-verde-esmalte'
                        }`}
                      >
                        {c.variacion == null
                          ? '—'
                          : `${c.variacion > 0 ? '+' : ''}${c.variacion}%`}
                      </td>

                      <td className="px-3 py-2.5">
                        {c.esPrincipal ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              value={c.renglon.margen}
                              onChange={(e) =>
                                actualizar(c.renglon.lineaId, 'margen', e.target.value)
                              }
                              inputMode="decimal"
                              className="input num text-right py-1.5"
                            />
                            <span className="text-xs text-verde-claro">
                              {c.renglon.margenTipo === 'porcentaje' ? '%' : '$'}
                            </span>
                          </div>
                        ) : (
                          <div className="text-right text-verde-claro">—</div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right num">
                        {!c.esPrincipal ? (
                          <span className="text-verde-claro">solo costo</span>
                        ) : c.renglon.precioManual ? (
                          <span className="text-verde-claro">sin cambio</span>
                        ) : c.valido ? (
                          <>
                            {formatearPrecio(c.precio.precioFinal)}
                            {c.renglon.precioActual > 0 && (
                              <span className="block text-xs text-verde-claro">
                                antes {formatearPrecio(c.renglon.precioActual)}
                              </span>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => quitar(c.renglon.lineaId)}
                          className="w-6 h-6 rounded text-tiza hover:text-rojo-plomo hover:bg-papel"
                          aria-label={`Quitar ${c.renglon.nombre}`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-5 space-y-4">
            <div className="flex items-end gap-4 flex-wrap">
              <label className="block">
                <span className="block text-xs text-verde-claro mb-1">
                  Total de la factura (opcional)
                </span>
                <input
                  value={totalFactura}
                  onChange={(e) => setTotalFactura(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="input num text-right w-40"
                />
              </label>

              <div className="text-sm">
                <div className="text-xs text-verde-claro">Suma de los renglones</div>
                <div className="num text-lg font-medium">
                  {formatearPrecio(sumaRenglones)}
                </div>
              </div>

              {nTotalFactura > 0 && (
                <div className="text-sm">
                  <div className="text-xs text-verde-claro">Diferencia</div>
                  <div
                    className={`num text-lg font-medium ${
                      Math.abs(diferenciaTotal) < 0.01
                        ? 'text-verde-esmalte'
                        : 'text-rojo-plomo'
                    }`}
                  >
                    {Math.abs(diferenciaTotal) < 0.01
                      ? 'coincide'
                      : formatearPrecio(diferenciaTotal)}
                  </div>
                </div>
              )}
            </div>

            {hayInvalidos && (
              <p className="text-sm text-ambar-dial">
                Hay renglones sin unidades o sin costo cargado.
              </p>
            )}

            {error && <p className="text-sm text-rojo-plomo">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={confirmar}
                disabled={!puedeConfirmar}
                className="px-5 py-2.5 rounded-lg bg-verde-esmalte text-white
                           font-medium disabled:opacity-40"
              >
                {guardando ? 'Aplicando…' : 'Actualizar costos'}
              </button>

              <p className="text-xs text-verde-claro">
                Se actualiza el costo de este proveedor y, si es el principal
                del artículo, también su costo, margen y precio de venta.
              </p>
            </div>
          </section>
        </>
      )}

      {listo && (
        <p className="text-sm text-verde-esmalte bg-mostrador rounded-lg
                      ring-1 ring-verde-claro/40 px-4 py-3">
          {listo}
        </p>
      )}
    </div>
  );
}