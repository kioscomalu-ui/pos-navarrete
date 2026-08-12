'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { parsearCSV, type ResultadoParseo } from '@/lib/importar-csv';
import { importarArticulos } from '@/app/(app)/articulos/importar/acciones';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { ReglaRedondeo } from '@pos/shared/types';

interface Props {
  codigosExistentes: string[];
  categoriasExistentes: string[];
  reglaRedondeo: ReglaRedondeo;
}

export function ImportadorCSV({ codigosExistentes, categoriasExistentes, reglaRedondeo }: Props) {
  const router = useRouter();
  const [resultado, setResultado] = useState<ResultadoParseo | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [modo, setModo] = useState<'crear' | 'actualizar'>('crear');
  const [mensaje, setMensaje] = useState('');
  const [pendiente, startTransition] = useTransition();

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setNombreArchivo(file.name);
    setMensaje('');

    const texto = await file.text();
    setResultado(
      parsearCSV(texto, {
        reglaRedondeo,
        codigosExistentes: new Set(codigosExistentes),
        categoriasExistentes: new Set(categoriasExistentes.map((c) => c.toLowerCase())),
      }),
    );
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
          stockInicial: f.stockInicial,
          stockMinimo: f.stockMinimo,
        })),
        modo,
      );

      if (r.ok) {
        setMensaje(
          `${r.creados} artículos creados` +
          (r.actualizados ? `, ${r.actualizados} actualizados` : '') +
          (r.categoriasCreadas ? `, ${r.categoriasCreadas} categorías nuevas` : ''),
        );
        setResultado(null);
        router.refresh();
      } else {
        setMensaje(r.error ?? 'Error desconocido');
      }
    });
  }

  const validas = resultado?.filas.filter((f) => f.errores.length === 0).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Carga de archivo */}
      <div className="bg-white border border-neutral-200 rounded p-6">
        <label className="block">
          <span className="block text-sm font-medium mb-2">Archivo CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onArchivo}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded
                       file:border-0 file:bg-neutral-900 file:text-white file:text-sm
                       file:cursor-pointer hover:file:bg-neutral-700"
          />
        </label>

        <details className="mt-4 text-sm text-neutral-500">
          <summary className="cursor-pointer">Formato esperado</summary>
          <pre className="mt-2 p-3 bg-neutral-50 rounded text-xs overflow-x-auto">
{`codigo_barras,nombre,categoria,unidad,costo,margen_tipo,margen_valor,stock_inicial,stock_minimo
7790040000001,Yerba Playadito 1kg,Almacen,unidad,2400,porcentaje,50,24,6`}
          </pre>
        </details>
      </div>

      {mensaje && (
        <div className="bg-white border border-neutral-200 rounded p-4 text-sm">
          {mensaje}
        </div>
      )}

      {/* Resumen y previsualización */}
      {resultado && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Tarjeta etiqueta="Filas leídas" valor={resultado.totalFilas} />
            <Tarjeta etiqueta="Válidas" valor={validas} destacar />
            <Tarjeta etiqueta="Con errores" valor={resultado.conErrores} alerta={resultado.conErrores > 0} />
            <Tarjeta etiqueta="Ya existen" valor={resultado.yaExisten} />
          </div>

          {resultado.categoriasNuevas.length > 0 && (
            <p className="text-sm text-neutral-500">
              Se crearán {resultado.categoriasNuevas.length} categorías nuevas:{' '}
              {resultado.categoriasNuevas.join(', ')}
            </p>
          )}

          {resultado.yaExisten > 0 && (
            <div className="bg-white border border-neutral-200 rounded p-4 space-y-2">
              <p className="text-sm font-medium">
                {resultado.yaExisten} códigos ya están en la base
              </p>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={modo === 'crear'} onChange={() => setModo('crear')} />
                  Omitirlos
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={modo === 'actualizar'} onChange={() => setModo('actualizar')} />
                  Actualizar costos y precios
                </label>
              </div>
            </div>
          )}

          <div className="bg-white border border-neutral-200 rounded overflow-hidden">
            <div className="px-4 py-2.5 border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              Previsualización · {nombreArchivo}
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500 text-xs sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">#</th>
                    <th className="text-left font-medium px-3 py-2">Artículo</th>
                    <th className="text-right font-medium px-3 py-2">Costo</th>
                    <th className="text-right font-medium px-3 py-2">Margen</th>
                    <th className="text-right font-medium px-3 py-2">Precio</th>
                    <th className="text-right font-medium px-3 py-2">Stock</th>
                    <th className="text-left font-medium px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {resultado.filas.map((f) => (
                    <tr key={f.linea} className={f.errores.length ? 'bg-red-50' : ''}>
                      <td className="px-3 py-1.5 text-neutral-400 font-mono text-xs">{f.linea}</td>
                      <td className="px-3 py-1.5">
                        {f.nombre}
                        {f.codigoBarras && (
                          <span className="ml-2 text-xs text-neutral-400 font-mono">
                            {f.codigoBarras}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {formatearPrecio(f.costo)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-neutral-500">
                        {f.margenTipo === 'porcentaje' ? `${f.margenValor}%` : `$${f.margenValor}`}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium">
                        {formatearPrecio(f.precioFinal)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-neutral-500">
                        {f.stockInicial || '—'}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {f.errores.length > 0 ? (
                          <span className="text-red-600">{f.errores.join(' · ')}</span>
                        ) : f.existeEnBase ? (
                          <span className="text-neutral-400">ya existe</span>
                        ) : (
                          <span className="text-neutral-400">nuevo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setResultado(null)}
              className="px-4 py-2 text-sm border border-neutral-300 rounded hover:bg-neutral-100"
            >
              Cancelar
            </button>

            <button
              onClick={confirmar}
              disabled={pendiente || validas === 0}
              className="px-5 py-2.5 bg-neutral-900 text-white rounded font-medium text-sm disabled:opacity-40"
            >
              {pendiente ? 'Importando…' : `Importar ${validas} artículos`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Tarjeta({
  etiqueta, valor, destacar, alerta,
}: { etiqueta: string; valor: number; destacar?: boolean; alerta?: boolean }) {
  return (
    <div className="bg-white border border-neutral-200 rounded p-4">
      <div className="text-xs text-neutral-500">{etiqueta}</div>
      <div className={`text-2xl font-mono mt-1 ${
        alerta ? 'text-red-600' : destacar ? 'font-semibold' : ''
      }`}>
        {valor}
      </div>
    </div>
  );
}