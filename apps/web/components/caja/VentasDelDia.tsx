'use client';

import { useCallback, useEffect, useState } from 'react';
import { dbLocal, type VentaLocal } from '@/lib/db-local';
import { RemitoImprimible } from './RemitoImprimible';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Props {
  nombreSucursal: string;
  nombreVendedor: string;
  onCerrar: () => void;
  onEmitirRemito: (ventaId: string) => Promise<string>;
}

const ETIQUETA_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  posnet: 'Tarjeta',
  billetera: 'Billetera',
  cuenta_corriente: 'Cta. corriente',
  mixto: 'Combinado',
};

export function VentasDelDia({
  nombreSucursal,
  nombreVendedor,
  onCerrar,
  onEmitirRemito,
}: Props) {
  const [ventas, setVentas] = useState<VentaLocal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [termino, setTermino] = useState('');
  const [imprimiendo, setImprimiendo] = useState<VentaLocal | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    // Las ventas viven en la base local del dispositivo, así que
    // esta pantalla muestra lo que se vendió DESDE ACÁ. Una venta
    // hecha en otra máquina no aparece.
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const fecha = `${anio}-${mes}-${dia}`;

    const todas = await dbLocal.ventas
      .where('fecha')
      .between(`${fecha}T00:00:00`, `${fecha}T23:59:59`, true, true)
      .toArray();

    setVentas(todas.sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtradas = termino.trim()
    ? ventas.filter((v) => {
        const t = termino.toLowerCase();
        return (
          v.numeroFactura.toLowerCase().includes(t) ||
          (v.remitoNumero ?? '').toLowerCase().includes(t) ||
          (v.clienteNombre ?? '').toLowerCase().includes(t) ||
          String(v.total).includes(t)
        );
      })
    : ventas;

  async function reimprimir(venta: VentaLocal) {
    setError('');
    try {
      // Si ya tenía remito devuelve el mismo número; si no, lo emite
      // ahora. En los dos casos no consume un número de más.
      const numero = await onEmitirRemito(venta.id);
      setImprimiendo({ ...venta, remitoNumero: numero });

      setTimeout(() => {
        window.print();
        setImprimiendo(null);
        void cargar();
      }, 120);
    } catch {
      setError('No se pudo emitir el remito. Revisá la conexión.');
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 flex items-start justify-center pt-12 z-50 p-4"
        onClick={onCerrar}
      >
        <div
          className="bg-mostrador rounded-lg shadow-xl w-full max-w-2xl overflow-hidden
                     flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-3 border-b border-tiza/60 flex items-center justify-between">
            <div>
              <h2 className="font-medium">Ventas de hoy</h2>
              <p className="text-xs text-verde-claro mt-0.5">
                Las hechas desde este dispositivo
              </p>
            </div>
            <button
              onClick={onCerrar}
              className="text-tiza hover:text-verde-esmalte text-xl leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <input
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder="Buscar por número, cliente o importe…"
            autoFocus
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full px-5 py-3 outline-none border-b border-tiza/60 bg-mostrador"
          />

          {error && (
            <p className="px-5 py-2 text-sm text-rojo-plomo bg-ambar-suave">
              {error}
            </p>
          )}

          <div className="flex-1 overflow-y-auto">
            {cargando && (
              <p className="px-5 py-10 text-center text-sm text-verde-claro">
                Cargando…
              </p>
            )}

            {!cargando && filtradas.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-verde-claro">
                {ventas.length === 0
                  ? 'Todavía no hay ventas hoy en este dispositivo'
                  : 'Sin resultados'}
              </p>
            )}

            <ul className="divide-y divide-tiza/40">
              {filtradas.map((v) => (
                <li
                  key={v.id}
                  className="px-5 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="num font-medium">
                        {formatearPrecio(v.total)}
                      </span>
                      <span className="text-xs text-verde-claro">
                        {new Date(v.fecha).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-xs text-verde-claro">
                        {ETIQUETA_PAGO[v.metodoPago] ?? v.metodoPago}
                      </span>
                    </div>
                    <div className="num text-xs text-verde-claro/70 mt-0.5 truncate">
                      {v.numeroFactura}
                      {v.remitoNumero && ` · Remito ${v.remitoNumero}`}
                      {v.clienteNombre && (
                        <span className="font-sans"> · {v.clienteNombre}</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => void reimprimir(v)}
                    className="px-3 py-1.5 text-sm rounded ring-1 ring-tiza/60
                               hover:ring-verde-claro whitespace-nowrap shrink-0"
                  >
                    {v.remitoNumero ? 'Reimprimir' : 'Imprimir'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {imprimiendo && (
        <RemitoImprimible
          venta={imprimiendo}
          sucursal={nombreSucursal}
          vendedor={nombreVendedor}
        />
      )}
    </>
  );
}