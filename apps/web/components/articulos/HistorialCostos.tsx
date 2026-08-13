'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Cambio {
  id: string;
  costo_anterior: number | null;
  costo_nuevo: number;
  variacion_pct: number | null;
  created_at: string;
  proveedores: { nombre: string } | null;
}

export function HistorialCostos({ articuloId }: { articuloId: string }) {
  const [cambios, setCambios] = useState<Cambio[]>([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    void supabase
      .from('historial_costos_proveedor')
      .select('id, costo_anterior, costo_nuevo, variacion_pct, created_at, proveedores(nombre)')
      .eq('articulo_id', articuloId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setCambios((data ?? []) as unknown as Cambio[]));
  }, [abierto, articuloId]);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full py-2 text-xs text-verde-claro hover:text-verde-esmalte"
      >
        Ver historial de costos
      </button>
    );
  }

  return (
    <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium">Historial de costos</h3>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-xs text-verde-claro"
        >
          Cerrar
        </button>
      </div>

      {cambios.length === 0 ? (
        <p className="text-xs text-verde-claro/70 py-4 text-center">
          Todavía no hay cambios registrados
        </p>
      ) : (
        <ul className="space-y-2">
          {cambios.map((c) => (
            <li
              key={c.id}
              className="flex items-baseline justify-between text-xs border-b
                         border-tiza/40 pb-2 last:border-0"
            >
              <div>
                <div>{c.proveedores?.nombre ?? '—'}</div>
                <div className="num text-verde-claro/70">
                  {new Date(c.created_at).toLocaleDateString('es-AR')}
                </div>
              </div>

              <div className="text-right">
                <div className="num">
                  {c.costo_anterior != null && (
                    <span className="text-verde-claro/60 line-through mr-1.5">
                      {formatearPrecio(Number(c.costo_anterior))}
                    </span>
                  )}
                  {formatearPrecio(Number(c.costo_nuevo))}
                </div>
                {c.variacion_pct != null && (
                  <div
                    className={`num ${
                      Number(c.variacion_pct) > 0
                        ? 'text-rojo-plomo'
                        : 'text-verde-ok'
                    }`}
                  >
                    {Number(c.variacion_pct) > 0 ? '+' : ''}
                    {Number(c.variacion_pct)}%
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
