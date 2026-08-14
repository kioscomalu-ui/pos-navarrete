'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  parsearCSV,
  PLANTILLA_CSV,
  type ResultadoParseo,
} from '@/lib/importar-csv';
import { importarArticulos } from '@/app/(app)/articulos/importar/acciones';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { ReglaRedondeo } from '@pos/shared/types';

interface Props {
  codigosExistentes: string[];
  categoriasExistentes: string[];
  reglaRedondeo: ReglaRedondeo;
  nombreSucursal: string;
}

export function ImportadorCSV({
  codigosExistentes,
  categoriasExistentes,
  reglaRedondeo,
  nombreSucursal,
}: Props) {
  const router = useRouter();

  const [resultado, setResultado] = useState<ResultadoParseo | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [modo, setModo] = useState<'crear' | 'actualizar'>('crear');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [pendiente, startTransition] = useTransition();

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setNombreArchivo(file.name);
    setMensaje('');
    setError('');

    try {
      const texto = await file.text();
      setResultado(
        parsearCSV(texto, {
          reglaRedondeo,
          codigosExistentes: new Set(codigosExistentes),
          categoriasExistentes: new Set(
            categoriasExistentes.map((c) => c.toLowerCase()),
          ),
        }),
      );
    } catch {
      setError('No se pudo leer el archivo. ¿Está guardado como CSV?');
    }
  }

  function confirmar() {
    if (!resultado) return;

    const validas = resultado.filas.filter((f) => f.errores.length === 0);

    startTransition(async () => {
      const r = await importarArticulos(
        validas.map((f) => ({
          codigoBarras: f.codigoBarras,
          nombre: f.nombre,
          categoria: f.categoria,
          unidad: f.unidad,
          costo: f.costo,
          margenTipo: f.margenTipo,
          margenValor: f.margenValor,
          precioBase: f.precioBase,
          redondeoAplicado: f.redondeoAplicado,
          precioFinal: f.precioFinal,
          precioManual: f.precioManual,
          stockInicial: f.stockInicial,
          stockMinimo: f.stockMinimo,
        })),
        modo,
      );

      if (!r.ok) {
        setError(r.error ?? 'Error desconocido durante la importación');
        return;
      }

      const partes: string[] = [];
      if (r.creados) partes.push(`${r.creados} artículos creados`);
      if (r.actualizados) partes.push(`${r.actualizados} actualizados`);
      if (r.categoriasCreadas)
        partes.push(`${r.categoriasCreadas} categorías nuevas`);
      if (r.conStock) partes.push(`${r.conStock} con stock inicial`);

      setMensaje(partes.join(' · '));
      setResultado(null);
      setNombreArchivo('');
      router.refresh();
    });
  }

  const validas = resultado?.filas.filter((f) => f.errores.length === 0) ?? [];

  return (
    <div className="space-y-5">
      {/* ============ Carga del archivo ============ */}
      <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <label className="block flex-1">
            <span className="block text-sm font-medium mb-2">Archivo CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onArchivo}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4
                         file:rounded-lg file:border-0 file:bg-verde-esmalte
                         file:text-white file:text-sm file:cursor-pointer
                         hover:file:bg-verde-hondo"
            />
          </label>

          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(PLANTILLA_CSV)}`}
            download="plantilla-articulos.csv"
            className="px-3 py-2 text-sm rounded-lg ring-1 ring-tiza/60
                       hover:ring-verde-claro whitespace-nowrap shrink-0"
          >
            Descargar plantilla
          </a>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-verde-claro">
            Cómo tiene que estar armado el archivo
          </summary>

          <div className="mt-3 space-y-3">
            <pre className="p-3 bg-papel rounded text-xs overflow-x-auto num">
{PLANTILLA_CSV}
            </pre>

            <ul className="text-xs text-verde-claro space-y-1.5 list-disc pl-4">
              <li>
                Si completás <span className="num">precio_venta</span>, ese es
                el precio y el margen se ignora. Si lo dejás vacío, el precio se
                calcula desde el costo.
              </li>
              <li>
                <span className="num">unidad</span>: unidad, kg, litro o metro.
                Los que no son "unidad" piden la cantidad al escanear.
              </li>
              <li>
                <span className="num">margen_tipo</span>: porcentaje o importe.
              </li>
              <li>
                El código de barras puede quedar vacío, pero entonces el
                artículo no recibe stock inicial.
              </li>
              <li>
                Los decimales van con punto o con coma: el sistema entiende los
                dos formatos.
              </li>
            </ul>
          </div>
        </details>
      </div>

      {/* ============ Mensajes ============ */}
      {mensaje && (
        <div className="bg-mostrador rounded-lg ring-1 ring-verde-ok/40 px-4 py-3 text-sm">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="bg-mostrador rounded-lg ring-1 ring-rojo-plomo/40 px-4 py-3
                        text-sm text-rojo-plomo">
          {error}
        </div>
      )}

      {/* ============ Previsualización ============ */}
      {resultado && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Tarjeta etiqueta="Filas leídas" valor={resultado.totalFilas} />
            <Tarjeta etiqueta="Válidas" valor={validas.length} destacar />
            <Tarjeta
              etiqueta="Con errores"
              valor={resultado.conErrores}
              alerta={resultado.conErrores > 0}
            />
            <Tarjeta etiqueta="Ya existen" valor={resultado.yaExisten} />
            <Tarjeta
              etiqueta="Precio fijo"
              valor={resultado.conPrecioManual}
            />
          </div>

          {resultado.categoriasNuevas.length > 0 && (
            <p className="text-sm text-verde-claro">
              Se van a crear{' '}
              <span className="num">{resultado.categoriasNuevas.length}</span>{' '}
              categorías nuevas: {resultado.categoriasNuevas.join(', ')}
            </p>
          )}

          {/* Qué hacer con los repetidos */}
          {resultado.yaExisten > 0 && (
            <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-5 space-y-3">
              <p className="text-sm font-medium">
                <span className="num">{resultado.yaExisten}</span> códigos ya
                están en la base
              </p>

              <div className="flex flex-col sm:flex-row gap-3 text-sm">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={modo === 'crear'}
                    onChange={() => setModo('crear')}
                    className="mt-0.5 accent-verde-esmalte"
                  />
                  <span>
                    Omitirlos
                    <span className="block text-xs text-verde-claro">
                      Solo se cargan los artículos nuevos
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={modo === 'actualizar'}
                    onChange={() => setModo('actualizar')}
                    className="mt-0.5 accent-verde-esmalte"
                  />
                  <span>
                    Actualizar costos y precios
                    <span className="block text-xs text-verde-claro">
                      Para cargar una lista de precios nueva del proveedor
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Tabla */}
          <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-tiza/50 text-xs
                            uppercase tracking-wide text-verde-claro">
              Previsualización · {nombreArchivo}
            </div>

            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm min-w-[46rem]">
                <thead className="bg-papel text-verde-claro text-xs sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">#</th>
                    <th className="text-left font-medium px-3 py-2">Artículo</th>
                    <th className="text-right font-medium px-3 py-2">Costo</th>
                    <th className="text-right font-medium px-3 py-2">Margen</th>
                    <th className="text-right font-medium px-3 py-2">Precio</th>
                    <th className="text-right font-medium px-3 py-2">Real</th>
                    <th className="text-right font-medium px-3 py-2">Stock</th>
                    <th className="text-left font-medium px-3 py-2">Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {resultado.filas.map((f, i) => (
                    <tr
                      key={f.linea}
                      className={
                        f.errores.length > 0
                          ? 'bg-ambar-suave'
                          : i % 2 === 0
                            ? 'renglon-impar'
                            : 'renglon-par'
                      }
                    >
                      <td className="num px-3 py-1.5 text-xs text-verde-claro/60">
                        {f.linea}
                      </td>

                      <td className="px-3 py-1.5">
                        {f.nombre}
                        {f.codigoBarras && (
                          <span className="num ml-2 text-xs text-verde-claro/60">
                            {f.codigoBarras}
                          </span>
                        )}
                        {f.unidad !== 'unidad' && (
                          <span className="ml-2 text-xs text-verde-claro">
                            por {f.unidad}
                          </span>
                        )}
                      </td>

                      <td className="num px-3 py-1.5 text-right text-verde-claro">
                        {formatearPrecio(f.costo)}
                      </td>

                      <td className="num px-3 py-1.5 text-right text-verde-claro">
                        {f.precioManual
                          ? '—'
                          : f.margenTipo === 'porcentaje'
                            ? `${f.margenValor}%`
                            : `$${f.margenValor}`}
                      </td>

                      <td className="num px-3 py-1.5 text-right font-medium">
                        {formatearPrecio(f.precioFinal)}
                        {f.precioManual && (
                          <span
                            className="ml-1.5 text-[0.6rem] uppercase tracking-wide
                                       text-verde-claro"
                            title="Precio fijado en el archivo"
                          >
                            fijo
                          </span>
                        )}
                      </td>

                      <td
                        className={`num px-3 py-1.5 text-right ${
                          f.margenReal < 10
                            ? 'text-rojo-plomo'
                            : 'text-verde-claro'
                        }`}
                      >
                        {f.margenReal}%
                      </td>

                      <td className="num px-3 py-1.5 text-right text-verde-claro">
                        {f.stockInicial || '—'}
                      </td>

                      <td className="px-3 py-1.5 text-xs">
                        {f.errores.length > 0 ? (
                          <span className="text-rojo-plomo">
                            {f.errores.join(' · ')}
                          </span>
                        ) : f.existeEnBase ? (
                          <span className="text-verde-claro">
                            {modo === 'actualizar'
                              ? 'se actualiza'
                              : 'ya existe'}
                          </span>
                        ) : (
                          <span className="text-verde-claro/60">nuevo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-verde-claro">
              El stock inicial se carga en {nombreSucursal}.
              {resultado.conErrores > 0 &&
                ' Las filas con error no se importan; corregilas en el archivo y volvé a subirlo.'}
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => {
                  setResultado(null);
                  setNombreArchivo('');
                }}
                className="px-4 py-2.5 text-sm rounded-lg ring-1 ring-tiza/60"
              >
                Cancelar
              </button>

              <button
                onClick={confirmar}
                disabled={pendiente || validas.length === 0}
                className="px-5 py-2.5 rounded-lg bg-verde-esmalte text-white
                           font-medium text-sm disabled:opacity-30"
              >
                {pendiente
                  ? 'Importando…'
                  : `Importar ${validas.length} artículos`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ====================================================================

function Tarjeta({
  etiqueta,
  valor,
  destacar,
  alerta,
}: {
  etiqueta: string;
  valor: number;
  destacar?: boolean;
  alerta?: boolean;
}) {
  return (
    <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-4">
      <div className="text-xs text-verde-claro">{etiqueta}</div>
      <div
        className={`num mt-1 ${destacar ? 'text-2xl font-semibold' : 'text-lg'} ${
          alerta ? 'text-rojo-plomo' : ''
        }`}
      >
        {valor}
      </div>
    </div>
  );
}