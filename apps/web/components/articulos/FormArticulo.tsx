'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  guardarArticulo,
  alternarActivoArticulo,
  ajustarStock,
  type EstadoForm,
} from '@/app/(app)/articulos/acciones';
import { ProveedoresArticulo } from './ProveedoresArticulo';
import { HistorialCostos } from './HistorialCostos';
import { calcularPrecio, calcularMargen } from '@pos/shared/utils/calcular-precio';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type {
  MargenTipo,
  ReglaRedondeo,
  UnidadMedida,
} from '@pos/shared/types';

interface Articulo {
  id: string;
  codigo_barras: string | null;
  codigo_interno: string | null;
  nombre: string;
  descripcion: string | null;
  categoria_id: string | null;
  unidad: UnidadMedida;
  costo_unitario: number;
  margen_tipo: MargenTipo;
  margen_valor: number;
  precio_venta_final: number | null;
  precio_manual: boolean;
  stock_minimo: number;
  stock_maximo: number | null;
  proveedor_principal_id: string | null;
  activo: boolean;
  es_servicio_comision: boolean;
  comision_porcentaje: number | null;
}

interface Props {
  articulo?: Articulo;
  categorias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  reglaDefault: ReglaRedondeo;
  margenDefault?: number;
  stockActual?: number;
}

export function FormArticulo({
  articulo,
  categorias,
  proveedores,
  reglaDefault,
  margenDefault = 30,
  stockActual,
}: Props) {
  const [estado, accion, guardando] = useActionState<EstadoForm, FormData>(
    guardarArticulo,
    {},
  );

  const [esServicio, setEsServicio] = useState(
    articulo?.es_servicio_comision ?? false,
  );
  const [comisionPorcentaje, setComisionPorcentaje] = useState(
    Number(articulo?.comision_porcentaje ?? 15),
  );

  const [costo, setCosto] = useState(Number(articulo?.costo_unitario ?? 0));
  const [margenTipo, setMargenTipo] = useState<MargenTipo>(
    articulo?.margen_tipo ?? 'porcentaje',
  );
  const [margenValor, setMargenValor] = useState(
    Number(articulo?.margen_valor ?? margenDefault),
  );
  const [regla, setRegla] = useState<ReglaRedondeo>(reglaDefault);
  const [unidad, setUnidad] = useState<UnidadMedida>(
    articulo?.unidad ?? 'unidad',
  );

  const [precioManual, setPrecioManual] = useState(
    articulo?.precio_manual ?? false,
  );
  const [precioFijo, setPrecioFijo] = useState(
    Number(articulo?.precio_venta_final ?? 0),
  );

  const calculado = useMemo(
    () =>
      calcularPrecio({
        costoUnitario: costo,
        margenTipo,
        margenValor,
        reglaRedondeo: regla,
      }),
    [costo, margenTipo, margenValor, regla],
  );

  const precioMostrado = precioManual ? precioFijo : calculado.precioFinal;

  const margenReal = useMemo(
    () => calcularMargen(costo, precioMostrado),
    [costo, precioMostrado],
  );

  const margenBajo = margenReal.porcentaje < 10;

  const atenuado = precioManual ? 'opacity-50' : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

      <form action={accion} id="form-articulo" className="space-y-5">
        {articulo && <input type="hidden" name="id" value={articulo.id} />}

        <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-3">
          <input
            type="hidden"
            name="esServicioComision"
            value={esServicio ? 'true' : 'false'}
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={esServicio}
              onChange={(e) => {
                setEsServicio(e.target.checked);
                if (e.target.checked) setUnidad('unidad');
              }}
              className="accent-verde-esmalte"
            />
            <span className="text-sm font-medium">
              Es un servicio con comisión (quiniela, recargas de celular…)
            </span>
          </label>

          {esServicio && (
            <>
              <p className="text-xs text-verde-claro">
                Sin stock ni precio fijo: el monto lo define el vendedor en
                cada venta. Solo hace falta el porcentaje que queda de
                ganancia — el resto es lo que se rinde después.
              </p>

              <Campo
                label="Comisión (%)"
                error={campoError(estado, 'comisionPorcentaje')}
              >
                <input
                  name="comisionPorcentaje"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={comisionPorcentaje}
                  onChange={(e) => setComisionPorcentaje(Number(e.target.value))}
                  required={esServicio}
                  className="input num text-right w-32"
                />
              </Campo>
            </>
          )}

          {esServicio && (
            <>
              <input type="hidden" name="costoUnitario" value="0" />
              <input type="hidden" name="margenTipo" value="importe" />
              <input type="hidden" name="margenValor" value="0" />
              <input type="hidden" name="reglaRedondeo" value="sin_redondeo" />
              <input type="hidden" name="precioManual" value="false" />
              <input type="hidden" name="stockMinimo" value="0" />
            </>
          )}
        </section>

        <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
          <h2 className="text-sm font-medium">Identificación</h2>

          <Campo label="Nombre" error={campoError(estado, 'nombre')}>
            <input
              name="nombre"
              defaultValue={articulo?.nombre}
              required
              autoFocus
              placeholder={esServicio ? 'Ej: Loto, Recarga Movistar' : undefined}
              className="input"
            />
          </Campo>

          {!esServicio && (
            <div className="grid grid-cols-2 gap-4">
              <Campo
                label="Código de barras"
                error={campoError(estado, 'codigoBarras')}
                ayuda="Con el lector conectado, escaneá el producto acá"
              >
                <input
                  name="codigoBarras"
                  defaultValue={articulo?.codigo_barras ?? ''}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.currentTarget.closest('form') ?? document)
                        .querySelector<HTMLInputElement>('input[name="nombre"]')
                        ?.focus();
                    }
                  }}
                  className="input num"
                />
              </Campo>

              <Campo label="Código interno" ayuda="Opcional, para uso propio">
                <input
                  name="codigoInterno"
                  defaultValue={articulo?.codigo_interno ?? ''}
                  className="input num"
                />
              </Campo>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Categoría">
              <select
                name="categoriaId"
                defaultValue={articulo?.categoria_id ?? ''}
                className="input"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            {!esServicio && (
              <Campo
                label="Unidad de venta"
                ayuda={
                  unidad === 'unidad'
                    ? 'Se escanea y se agrega de a uno'
                    : 'La caja va a pedir la cantidad al escanear'
                }
              >
                <select
                  name="unidad"
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value as UnidadMedida)}
                  className="input"
                >
                  <option value="unidad">Por unidad</option>
                  <option value="kg">Por kilogramo</option>
                  <option value="litro">Por litro</option>
                  <option value="metro">Por metro</option>
                </select>
              </Campo>
            )}
          </div>

          {esServicio && <input type="hidden" name="unidad" value="unidad" />}

          {!esServicio && (
            <Campo
              label="Proveedor principal"
              ayuda={
                articulo
                  ? 'Se cambia desde el panel de proveedores, más abajo'
                  : 'Después vas a poder cargar varios proveedores'
              }
            >
              <select
                name="proveedorId"
                defaultValue={articulo?.proveedor_principal_id ?? ''}
                className="input"
              >
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <Campo label="Descripción" ayuda="Opcional">
            <input
              name="descripcion"
              defaultValue={articulo?.descripcion ?? ''}
              className="input"
            />
          </Campo>
        </section>

        {!esServicio && (
          <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
            <h2 className="text-sm font-medium">Costo y ganancia</h2>

            <div className="grid grid-cols-3 gap-4">
              <Campo
                label={
                  unidad === 'unidad' ? 'Costo por unidad' : `Costo por ${unidad}`
                }
              >
                <input
                  name="costoUnitario"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costo}
                  onChange={(e) => setCosto(Number(e.target.value))}
                  required
                  className="input num text-right"
                />
              </Campo>

              <Campo label="Tipo de margen">
                <select
                  name="margenTipo"
                  value={margenTipo}
                  onChange={(e) => setMargenTipo(e.target.value as MargenTipo)}
                  className={`input ${atenuado}`}
                >
                  <option value="porcentaje">Porcentaje</option>
                  <option value="importe">Importe fijo</option>
                </select>
              </Campo>

              <Campo
                label={margenTipo === 'porcentaje' ? 'Margen (%)' : 'Margen ($)'}
                error={campoError(estado, 'margenValor')}
              >
                <input
                  name="margenValor"
                  type="number"
                  step="0.01"
                  value={margenValor}
                  onChange={(e) => setMargenValor(Number(e.target.value))}
                  required
                  className={`input num text-right ${atenuado}`}
                />
              </Campo>
            </div>

            <Campo label="Redondeo">
              <select
                name="reglaRedondeo"
                value={regla}
                onChange={(e) => setRegla(e.target.value as ReglaRedondeo)}
                className={`input ${atenuado}`}
              >
                <option value="sin_redondeo">Sin redondeo</option>
                <option value="al_peso">Al peso entero</option>
                <option value="al_cincuenta">A .00 o .50</option>
                <option value="a_la_decena">A la decena</option>
                <option value="a_la_centena">A la centena</option>
              </select>
            </Campo>

            <div className="pt-4 border-t border-tiza/40 space-y-3">
              <input
                type="hidden"
                name="precioManual"
                value={precioManual ? 'true' : 'false'}
              />

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={precioManual}
                  onChange={(e) => {
                    setPrecioManual(e.target.checked);
                    if (e.target.checked && !precioFijo) {
                      setPrecioFijo(calculado.precioFinal);
                    }
                  }}
                  className="accent-verde-esmalte"
                />
                <span className="text-sm">Fijar el precio de venta a mano</span>
              </label>

              {precioManual && (
                <>
                  <Campo
                    label="Precio de venta"
                    error={campoError(estado, 'precioFijo')}
                  >
                    <input
                      name="precioFijo"
                      type="number"
                      step="0.01"
                      min="0"
                      value={precioFijo}
                      onChange={(e) => setPrecioFijo(Number(e.target.value))}
                      className="input num text-right text-lg"
                    />
                  </Campo>

                  <p className="text-xs text-ambar-dial">
                    Este precio no se recalcula cuando sube el costo, ni siquiera
                    en un ajuste masivo. El costo y el margen quedan como
                    referencia.
                  </p>
                </>
              )}
            </div>
          </section>
        )}

        {!esServicio && (
          <section className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
            <h2 className="text-sm font-medium">Stock</h2>

            <div className="grid grid-cols-2 gap-4">
              <Campo
                label="Stock mínimo"
                ayuda="Debajo de este número aparece en Faltantes"
              >
                <input
                  name="stockMinimo"
                  type="number"
                  step="0.001"
                  min="0"
                  defaultValue={Number(articulo?.stock_minimo ?? 0)}
                  className="input num text-right"
                />
              </Campo>

              <Campo label="Stock máximo" ayuda="Opcional, referencia de compra">
                <input
                  name="stockMaximo"
                  type="number"
                  step="0.001"
                  min="0"
                  defaultValue={
                    articulo?.stock_maximo != null
                      ? Number(articulo.stock_maximo)
                      : ''
                  }
                  className="input num text-right"
                />
              </Campo>
            </div>
          </section>
        )}
      </form>

      <aside className="space-y-3 lg:sticky lg:top-20">
        <div className="bg-verde-esmalte rounded-lg overflow-hidden shadow-lg">
          <div
            className={`h-1 ${
              !esServicio && margenBajo ? 'bg-rojo-plomo' : 'bg-verde-claro/40'
            }`}
          />

          <div className="p-5 space-y-3">
            {esServicio ? (
              <>
                <div className="text-[0.65rem] uppercase tracking-[0.18em] text-tiza/70">
                  Servicio con comisión
                </div>
                <p className="text-xs text-tiza/70">
                  El monto lo carga el vendedor en cada venta. De cada $100
                  jugados o cargados, quedan{' '}
                  <span className="text-white font-medium">
                    {formatearPrecio(comisionPorcentaje)}
                  </span>{' '}
                  de ganancia.
                </p>
                <div className="border-t border-white/15 pt-3 flex items-baseline justify-between">
                  <span className="text-xs text-tiza/70">Comisión</span>
                  <span className="num text-2xl font-bold text-white">
                    {comisionPorcentaje}%
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-[0.65rem] uppercase tracking-[0.18em] text-tiza/70">
                  {precioManual ? 'Precio fijado' : 'Precio calculado'}
                </div>

                {precioManual ? (
                  <p className="text-xs text-tiza/70">
                    Ingresado a mano. El costo y el margen quedan como referencia.
                  </p>
                ) : (
                  <dl className="num text-sm space-y-1.5 text-tiza">
                    <Fila etiqueta="Costo" valor={formatearPrecio(costo)} />
                    <Fila
                      etiqueta={
                        margenTipo === 'porcentaje'
                          ? `+ ${margenValor}%`
                          : `+ $${margenValor}`
                      }
                      valor={formatearPrecio(calculado.precioBase - costo)}
                    />
                    <Fila
                      etiqueta="Redondeo"
                      valor={`${calculado.redondeoAplicado >= 0 ? '+' : ''}${formatearPrecio(
                        calculado.redondeoAplicado,
                      )}`}
                    />
                  </dl>
                )}

                <div className="border-t border-white/15 pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-tiza/70">Precio de venta</span>
                    <span className="num text-2xl font-bold text-white">
                      {formatearPrecio(precioMostrado)}
                    </span>
                  </div>

                  <p
                    className={`num text-xs mt-1 text-right ${
                      margenBajo ? 'text-ambar-dial' : 'text-tiza/60'
                    }`}
                  >
                    margen real {margenReal.porcentaje}%
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {estado.error && !estado.campo && (
          <p className="text-sm text-rojo-plomo bg-mostrador rounded-lg
                        ring-1 ring-rojo-plomo/30 px-4 py-3">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          form="form-articulo"
          disabled={guardando}
          className="w-full py-3 rounded-lg bg-verde-esmalte text-white font-medium
                     hover:bg-verde-hondo disabled:opacity-40"
        >
          {guardando
            ? 'Guardando…'
            : articulo
              ? 'Guardar cambios'
              : 'Crear artículo'}
        </button>

        <Link
          href="/articulos"
          className="block w-full py-2.5 text-center text-sm rounded-lg
                     bg-mostrador ring-1 ring-tiza/60"
        >
          Cancelar
        </Link>

        {articulo && (
          <>
            {!esServicio && (
              <AjusteStock
                articuloId={articulo.id}
                unidad={articulo.unidad}
                stockActual={stockActual ?? 0}
              />
            )}
            <HistorialCostos articuloId={articulo.id} />
            <BajaArticulo id={articulo.id} activo={articulo.activo} />
          </>
        )}
      </aside>

      {articulo && !esServicio && (
        <div className="lg:col-start-1 lg:row-start-2">
          <ProveedoresArticulo
            articuloId={articulo.id}
            proveedores={proveedores}
          />
        </div>
      )}
    </div>
  );
}

function AjusteStock({
  articuloId,
  unidad,
  stockActual,
}: {
  articuloId: string;
  unidad: UnidadMedida;
  stockActual: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState(String(stockActual));
  const [razon, setRazon] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [pendiente, startTransition] = useTransition();

  if (!abierto) {
    return (
      <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-verde-claro">Stock actual</span>
          <span className="num font-medium">
            {unidad === 'unidad' ? stockActual : stockActual.toFixed(3)}
            <span className="text-xs text-verde-claro ml-1">
              {unidad === 'unidad' ? 'un' : unidad}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full mt-3 py-2 text-xs text-verde-claro hover:text-verde-esmalte"
        >
          Ajustar stock
        </button>

        {mensaje && (
          <p className="text-xs text-verde-ok mt-2 text-center">{mensaje}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-4 space-y-3">
      <h3 className="text-xs font-medium">Ajustar stock</h3>

      <label className="block">
        <span className="block text-xs text-verde-claro mb-1">
          Cantidad contada
        </span>
        <input
          type="number"
          step="0.001"
          min="0"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="input num text-right"
        />
      </label>

      <label className="block">
        <span className="block text-xs text-verde-claro mb-1">Motivo</span>
        <input
          value={razon}
          onChange={(e) => setRazon(e.target.value)}
          placeholder="Conteo físico, rotura, devolución…"
          className="input"
        />
      </label>

      {mensaje && <p className="text-xs text-rojo-plomo">{mensaje}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setMensaje('');
          }}
          className="flex-1 py-2 text-xs rounded ring-1 ring-tiza/60"
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={pendiente || razon.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              const r = await ajustarStock(
                articuloId,
                Number(cantidad.replace(',', '.')),
                razon,
              );
              if (r.error) {
                setMensaje(r.error);
              } else {
                setMensaje('Stock actualizado');
                setAbierto(false);
                setRazon('');
              }
            })
          }
          className="flex-1 py-2 text-xs rounded bg-verde-esmalte text-white
                     disabled:opacity-30"
        >
          {pendiente ? 'Guardando…' : 'Ajustar'}
        </button>
      </div>

      <p className="text-xs text-verde-claro/70">
        El ajuste queda registrado con tu nombre y el motivo.
      </p>
    </div>
  );
}

function BajaArticulo({ id, activo }: { id: string; activo: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  if (!activo) {
    return (
      <div className="bg-papel rounded-lg p-4 text-center space-y-2">
        <p className="text-xs text-verde-claro">
          Este artículo está dado de baja. No aparece en la caja, pero sigue en
          los reportes históricos.
        </p>
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            startTransition(() => {
              void alternarActivoArticulo(id, true);
            })
          }
          className="text-xs text-verde-esmalte font-medium disabled:opacity-40"
        >
          Reactivar artículo
        </button>
      </div>
    );
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="w-full py-2 text-xs text-verde-claro hover:text-rojo-plomo"
      >
        Dar de baja este artículo
      </button>
    );
  }

  return (
    <div className="bg-ambar-suave border-l-4 border-ambar-dial rounded-r p-4 space-y-3">
      <p className="text-xs">
        Va a desaparecer de la caja en la próxima apertura. Las ventas
        anteriores lo siguen mostrando.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="flex-1 py-2 text-xs rounded ring-1 ring-tiza"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            startTransition(() => {
              void alternarActivoArticulo(id, false);
            })
          }
          className="flex-1 py-2 text-xs rounded bg-rojo-plomo text-white
                     disabled:opacity-40"
        >
          {pendiente ? 'Dando de baja…' : 'Dar de baja'}
        </button>
      </div>
    </div>
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

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-tiza/70">{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}