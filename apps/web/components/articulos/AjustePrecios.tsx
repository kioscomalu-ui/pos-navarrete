'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface Fila {
  nombre: string;
  costo_actual: number;
  precio_actual: number;
  costo_nuevo: number;
  precio_nuevo: number;
  afectados: number;
}

export function AjustePrecios({
  categorias,
  proveedores,
}: {
  categorias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [porcentaje, setPorcentaje] = useState('');
  const [sobre, setSobre] = useState<'costo' | 'precio'>('costo');
  const [categoria, setCategoria] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [vista, setVista] = useState<Fila[] | null>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [pendiente, startTransition] = useTransition();

  const pct = Number(porcentaje.replace(',', '.'));
  const valido = Number.isFinite(pct) && pct !== 0;
  const afectados = vista?.[0]?.afectados ?? 0;

  async function previsualizar() {
    setMensaje('');
    const { data, error } = await supabase.rpc('previsualizar_ajuste', {
      p_porcentaje: pct,
      p_categoria_id: categoria || null,
      p_proveedor_id: proveedor || null,
      p_sobre: sobre,
      p_limite: 15,
    });

    if (error) {
      setMensaje(error.message);
      return;
    }
    setVista((data ?? []) as Fila[]);
    setConfirmacion('');
  }

  function aplicar() {
    startTransition(async () => {
      const { data, error } = await supabase.rpc('ajustar_precios', {
        p_porcentaje: pct,
        p_categoria_id: categoria || null,
        p_proveedor_id: proveedor || null,
        p_sobre: sobre,
      });

      if (error) {
        setMensaje(error.message);
        return;
      }

      setMensaje(`${data} artículos actualizados`);
      setVista(null);
      setPorcentaje('');
      router.refresh();
    });
  }

  const textoEsperado = `AJUSTAR ${afectados}`;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Parámetros */}
      <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs text-verde-claro mb-1">
              Porcentaje
            </span>
            <div className="flex items-center gap-2">
              <input
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                inputMode="decimal"
                placeholder="12,5"
                className="input num text-right text-lg"
              />
              <span className="num text-lg text-verde-claro">%</span>
            </div>
            <span className="block text-xs text-verde-claro/70 mt-1">
              Negativo para bajar precios
            </span>
          </label>

          <label className="block">
            <span className="block text-xs text-verde-claro mb-1">
              Aplicar sobre
            </span>
            <select
              value={sobre}
              onChange={(e) => setSobre(e.target.value as 'costo' | 'precio')}
              className="input"
            >
              <option value="costo">El costo (mantiene el margen)</option>
              <option value="precio">El precio de venta (sube el margen)</option>
            </select>
            <span className="block text-xs text-verde-claro/70 mt-1">
              {sobre === 'costo'
                ? 'Para trasladar un aumento del proveedor'
                : 'Para mejorar rentabilidad sin cambiar el costo'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs text-verde-claro mb-1">
              Categoría
            </span>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="input"
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs text-verde-claro mb-1">
              Proveedor
            </span>
            <select
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              className="input"
            >
              <option value="">Todos</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          onClick={previsualizar}
          disabled={!valido}
          className="w-full py-2.5 rounded-lg bg-mostrador ring-1 ring-tiza/60
                     hover:ring-verde-claro text-sm disabled:opacity-30"
        >
          Ver qué cambiaría
        </button>
      </div>

      {mensaje && (
        <p className="text-sm bg-mostrador ring-1 ring-tiza/60 rounded-lg px-4 py-3">
          {mensaje}
        </p>
      )}

      {/* Previsualización */}
      {vista && (
        <>
          <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-tiza/50 text-sm">
              <span className="num font-medium">{afectados}</span> artículos se
              van a modificar · mostrando los primeros{' '}
              <span className="num">{vista.length}</span>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-papel text-verde-claro text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Artículo</th>
                  <th className="text-right font-medium px-4 py-2">Costo</th>
                  <th className="text-right font-medium px-4 py-2">
                    Costo nuevo
                  </th>
                  <th className="text-right font-medium px-4 py-2">Precio</th>
                  <th className="text-right font-medium px-4 py-2">
                    Precio nuevo
                  </th>
                </tr>
              </thead>
              <tbody>
                {vista.map((f, i) => (
                  <tr
                    key={f.nombre}
                    className={i % 2 === 0 ? 'renglon-impar' : 'renglon-par'}
                  >
                    <td className="px-4 py-2">{f.nombre}</td>
                    <td className="num px-4 py-2 text-right text-verde-claro">
                      {formatearPrecio(Number(f.costo_actual))}
                    </td>
                    <td className="num px-4 py-2 text-right">
                      {formatearPrecio(Number(f.costo_nuevo))}
                    </td>
                    <td className="num px-4 py-2 text-right text-verde-claro">
                      {formatearPrecio(Number(f.precio_actual))}
                    </td>
                    <td className="num px-4 py-2 text-right font-medium">
                      {formatearPrecio(Number(f.precio_nuevo))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirmación */}
          <div className="bg-ambar-suave border-l-4 border-ambar-dial rounded-r p-5 space-y-3">
            <p className="text-sm">
              Esto modifica <span className="num font-medium">{afectados}</span>{' '}
              artículos y no se puede deshacer con un botón. Escribí{' '}
              <span className="num font-medium">{textoEsperado}</span> para
              confirmar.
            </p>

            <input
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder={textoEsperado}
              className="input num"
            />

            <button
              onClick={aplicar}
              disabled={
                pendiente ||
                confirmacion.trim().toUpperCase() !== textoEsperado
              }
              className="w-full py-3 rounded-lg bg-verde-esmalte text-white
                         font-medium disabled:opacity-30"
            >
              {pendiente ? 'Aplicando…' : 'Aplicar ajuste'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}