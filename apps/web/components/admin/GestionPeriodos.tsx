'use client';

import { useState, useTransition } from 'react';
import {
  archivarPeriodo,
  verificarArchivo,
  purgarPeriodo,
  type ResultadoPaso,
} from '@/app/(app)/admin/mantenimiento/acciones';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Mes {
  anio: number;
  mes: number;
  cantidad: number;
  monto: number;
  purgado: boolean;
}

interface Cierre {
  id: string;
  desde: string;
  hasta: string;
  cantidad_ventas: number;
  agregados_calculados: boolean;
  archivo_verificado: boolean;
  detalle_purgado: boolean;
  url_archivo: string | null;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function GestionPeriodos({
  meses,
  cierres,
}: {
  meses: Mes[];
  cierres: Cierre[];
}) {
  const [seleccion, setSeleccion] = useState<Mes | null>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [resultado, setResultado] = useState<ResultadoPaso | null>(null);
  const [pendiente, startTransition] = useTransition();

  const hace90dias = new Date();
  hace90dias.setDate(hace90dias.getDate() - 90);

  function rangoDe(m: Mes) {
    const desde = `${m.anio}-${String(m.mes).padStart(2, '0')}-01`;
    const ultimo = new Date(m.anio, m.mes, 0).getDate();
    const hasta = `${m.anio}-${String(m.mes).padStart(2, '0')}-${ultimo}`;
    return { desde, hasta };
  }

  function esViejo(m: Mes) {
    return new Date(m.anio, m.mes, 0) < hace90dias;
  }

  const cierreDe = (m: Mes) => {
    const { desde } = rangoDe(m);
    return cierres.find((c) => c.desde === desde);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium">Depuración de períodos</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Los resúmenes por día y por artículo sobreviven a la purga: los
          reportes históricos siguen funcionando.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Mes</th>
              <th className="text-right font-medium px-4 py-2.5">Ventas</th>
              <th className="text-right font-medium px-4 py-2.5">Facturado</th>
              <th className="text-left font-medium px-4 py-2.5">Estado</th>
              <th className="text-right font-medium px-4 py-2.5"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100">
            {meses.map((m) => {
              const cierre = cierreDe(m);
              const viejo = esViejo(m);

              return (
                <tr key={`${m.anio}-${m.mes}`} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    {MESES[m.mes - 1]} {m.anio}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {Number(m.cantidad).toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatearPrecio(Number(m.monto))}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {m.purgado ? (
                      <span className="text-neutral-400">purgado</span>
                    ) : cierre?.archivo_verificado ? (
                      <span className="text-emerald-700">verificado</span>
                    ) : cierre ? (
                      <span className="text-amber-700">archivado</span>
                    ) : !viejo ? (
                      <span className="text-neutral-400">
                        menos de 90 días
                      </span>
                    ) : (
                      <span className="text-neutral-400">sin archivar</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {viejo && !m.purgado && (
                      <button
                        onClick={() => {
                          setSeleccion(m);
                          setResultado(null);
                          setConfirmacion('');
                        }}
                        className="text-sm text-neutral-500 hover:text-neutral-900"
                      >
                        Gestionar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {meses.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            No hay ventas registradas
          </p>
        )}
      </div>

      {/* Panel del período elegido */}
      {seleccion && (
        <div className="bg-white border border-neutral-200 rounded p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium">
                {MESES[seleccion.mes - 1]} {seleccion.anio}
              </h3>
              <p className="text-sm text-neutral-500">
                {Number(seleccion.cantidad).toLocaleString('es-AR')} ventas ·{' '}
                {formatearPrecio(Number(seleccion.monto))}
              </p>
            </div>
            <button
              onClick={() => setSeleccion(null)}
              className="text-neutral-400 hover:text-neutral-900"
            >
              ×
            </button>
          </div>

          {(() => {
            const cierre = cierreDe(seleccion);
            const { desde, hasta } = rangoDe(seleccion);
            const textoEsperado = `PURGAR ${desde} A ${hasta}`;

            return (
              <ol className="space-y-4">
                <Paso
                  n={1}
                  titulo="Archivar el detalle"
                  detalle="Exporta las ventas comprimidas a Storage y calcula los resúmenes"
                  hecho={!!cierre}
                  accion={
                    <button
                      disabled={pendiente || !!cierre}
                      onClick={() =>
                        startTransition(async () => {
                          setResultado(await archivarPeriodo(desde, hasta));
                        })
                      }
                      className="px-4 py-2 text-sm bg-neutral-900 text-white rounded disabled:opacity-30"
                    >
                      Archivar
                    </button>
                  }
                />

                <Paso
                  n={2}
                  titulo="Verificar el archivo"
                  detalle="Lo descarga y comprueba el hash y que sea legible"
                  hecho={!!cierre?.archivo_verificado}
                  accion={
                    <button
                      disabled={pendiente || !cierre || cierre.archivo_verificado}
                      onClick={() =>
                        startTransition(async () => {
                          setResultado(await verificarArchivo(cierre!.id));
                        })
                      }
                      className="px-4 py-2 text-sm border border-neutral-300 rounded disabled:opacity-30"
                    >
                      Verificar
                    </button>
                  }
                />

                <Paso
                  n={3}
                  titulo="Purgar de la base operativa"
                  detalle="Elimina el detalle. Los resúmenes y el archivo quedan."
                  hecho={!!cierre?.detalle_purgado}
                  accion={
                    <div className="space-y-2">
                      <input
                        value={confirmacion}
                        onChange={(e) => setConfirmacion(e.target.value)}
                        disabled={!cierre?.archivo_verificado}
                        placeholder={textoEsperado}
                        className="w-full px-3 py-2 border border-neutral-300 rounded text-sm font-mono disabled:bg-neutral-50"
                      />
                      <button
                        disabled={
                          pendiente ||
                          !cierre?.archivo_verificado ||
                          cierre.detalle_purgado ||
                          confirmacion.trim().toUpperCase() !==
                            textoEsperado.toUpperCase()
                        }
                        onClick={() =>
                          startTransition(async () => {
                            setResultado(
                              await purgarPeriodo(
                                cierre!.id,
                                confirmacion,
                                textoEsperado,
                              ),
                            );
                          })
                        }
                        className="w-full px-4 py-2 text-sm bg-red-700 text-white rounded disabled:opacity-30"
                      >
                        Purgar período
                      </button>
                    </div>
                  }
                />
              </ol>
            );
          })()}

          {resultado && (
            <p
              className={`text-sm rounded px-3 py-2 ${
                resultado.ok
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {resultado.mensaje}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Paso({
  n, titulo, detalle, hecho, accion,
}: {
  n: number;
  titulo: string;
  detalle: string;
  hecho: boolean;
  accion: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 items-start">
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
          hecho ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-600'
        }`}
      >
        {hecho ? '✓' : n}
      </span>

      <div className="flex-1">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{detalle}</p>
      </div>

      <div className="w-56">{accion}</div>
    </li>
  );
}