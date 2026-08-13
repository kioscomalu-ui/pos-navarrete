'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCaja } from '@/hooks/useCaja';
import { useEscaner } from '@/hooks/useEscaner';
import { AperturaCaja } from './AperturaCaja';
import { CierreCaja } from './CierreCaja';
import { BuscadorArticulos } from './BuscadorArticulos';
import { CobroEfectivo } from './CobroEfectivo';
import { SelectorCliente } from './SelectorCliente';
import { RemitoImprimible } from './RemitoImprimible';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { MetodoPago } from '@pos/shared/types';
import type { VentaLocal, ClienteLocal } from '@/lib/db-local';

interface Props {
  sucursalId: string;
  vendedorId: string;
  codigoSucursal: string;
  nombreSucursal: string;
  nombreVendedor: string;
  puntoVenta: number;
  umbralDiferencia: number;
}

export function PantallaCaja(props: Props) {
  const {
    engine,
    carrito,
    listo,
    infoCarga,
    online,
    enCola,
    catalogo,
    caja,
    buscandoCaja,
    abrir,
    cerrar,
  } = useCaja({
    sucursalId: props.sucursalId,
    vendedorId: props.vendedorId,
    codigoSucursal: props.codigoSucursal,
    puntoVenta: props.puntoVenta,
  });

  const [aviso, setAviso] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [pidiendoEfectivo, setPidiendoEfectivo] = useState(false);
  const [eligiendoCliente, setEligiendoCliente] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState<VentaLocal | null>(null);
  const inputPeso = useRef<HTMLInputElement>(null);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(''), 2500);
  }, []);

  // ---- Escáner ----
  const alEscanear = useCallback(
    (codigo: string) => {
      const r = engine.escanear(codigo);

      if (!r.ok) {
        mostrarAviso(`Código no encontrado: ${codigo}`);
        return;
      }

      const avisoStock = engine.consumirAvisoStock();
      if (avisoStock) mostrarAviso(avisoStock);

      if (r.item.requiereCantidad) {
        setTimeout(() => inputPeso.current?.focus(), 0);
      }
    },
    [engine, mostrarAviso],
  );

  const hayModal =
    buscando || pidiendoEfectivo || eligiendoCliente || cerrando || !!ultimaVenta;

  useEscaner(alEscanear, listo && !!caja && !hayModal);

  // ---- Cobro ----
  const ejecutarCobro = useCallback(
    async (
      metodo: MetodoPago,
      recibido?: number,
      cliente?: { id: string; nombre: string },
    ) => {
      try {
        const venta = await engine.cobrar(metodo, recibido, cliente);
        setUltimaVenta(venta);
        setPidiendoEfectivo(false);
        setEligiendoCliente(false);
      } catch (e) {
        mostrarAviso(e instanceof Error ? e.message : 'Error al cobrar');
      }
    },
    [engine, mostrarAviso],
  );

  const cobrar = useCallback(
    (metodo: MetodoPago) => {
      if (carrito.items.length === 0) return;
      if (carrito.hayPendientes) {
        mostrarAviso('Falta ingresar el peso de un artículo');
        return;
      }

      // El efectivo pasa por el modal para calcular el vuelto
      if (metodo === 'efectivo') {
        setPidiendoEfectivo(true);
        return;
      }
      // La cuenta corriente necesita elegir el cliente
      if (metodo === 'cuenta_corriente') {
        setEligiendoCliente(true);
        return;
      }

      void ejecutarCobro(metodo);
    },
    [carrito, ejecutarCobro, mostrarAviso],
  );

  // ---- Remito ----
  const imprimirRemito = useCallback(async () => {
    if (!ultimaVenta) return;
    try {
      const numero = await engine.emitirRemito(ultimaVenta.id);
      setUltimaVenta({ ...ultimaVenta, remitoNumero: numero });
      setImprimiendo(true);
      setTimeout(() => {
        window.print();
        setImprimiendo(false);
      }, 100);
    } catch {
      mostrarAviso('No se pudo emitir el remito');
    }
  }, [ultimaVenta, engine, mostrarAviso]);

  // ---- Atajos de teclado ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Pantalla de vuelto
      if (ultimaVenta) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setUltimaVenta(null);
        }
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          void imprimirRemito();
        }
        return;
      }

      // Los modales y el arqueo manejan sus propias teclas
      if (pidiendoEfectivo || eligiendoCliente || buscando || cerrando || !caja) {
        return;
      }

      if (e.key === 'F1') { e.preventDefault(); cobrar('efectivo'); }
      if (e.key === 'F2') { e.preventDefault(); cobrar('posnet'); }
      if (e.key === 'F3') { e.preventDefault(); cobrar('billetera'); }
      if (e.key === 'F4') { e.preventDefault(); setBuscando(true); }
      if (e.key === 'F5') { e.preventDefault(); cobrar('cuenta_corriente'); }
      if (e.key === 'Escape') { e.preventDefault(); engine.limpiar(); }
      if (e.key === 'Delete') { e.preventDefault(); engine.quitarUltimo(); }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    cobrar,
    engine,
    ultimaVenta,
    imprimirRemito,
    pidiendoEfectivo,
    eligiendoCliente,
    buscando,
    cerrando,
    caja,
  ]);

  // ================================================================
  // Estados previos a la venta
  // ================================================================

  if (buscandoCaja) {
    return <p className="py-24 text-center text-neutral-500">Cargando…</p>;
  }

  if (!caja) {
    return (
      <AperturaCaja
        nombreVendedor={props.nombreVendedor}
        sucursal={props.nombreSucursal}
        onAbrir={(monto) => void abrir(monto)}
        cargando={false}
      />
    );
  }

  if (cerrando) {
    return (
      <CierreCaja
        caja={caja}
        umbralDiferencia={props.umbralDiferencia}
        onCerrar={async (d) => {
          await cerrar(d);
          setCerrando(false);
        }}
        onVolver={() => setCerrando(false)}
        cargando={false}
      />
    );
  }

  if (!listo) {
    return (
      <div className="py-24 text-center text-neutral-500">
        <p>Cargando catálogo…</p>
        <p className="text-sm mt-1">{infoCarga}</p>
      </div>
    );
  }

  // ================================================================
  // Pantalla de vuelto
  // ================================================================

  if (ultimaVenta) {
    const hayVuelto = ultimaVenta.vuelto != null && ultimaVenta.vuelto > 0;
    const esFiado = ultimaVenta.metodoPago === 'cuenta_corriente';

    return (
      <>
        <div className="py-12 text-center space-y-8">
          {hayVuelto ? (
            <div>
              <p className="text-sm text-neutral-500">Vuelto</p>
              <p className="text-7xl font-mono font-semibold text-emerald-700">
                {formatearPrecio(ultimaVenta.vuelto!)}
              </p>
              <p className="text-sm text-neutral-500 mt-3">
                Total {formatearPrecio(ultimaVenta.total)} · Recibido{' '}
                {formatearPrecio(ultimaVenta.recibido ?? 0)}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-neutral-500">
                {esFiado ? 'Cargado a cuenta' : 'Cobrado'}
              </p>
              <p className="text-6xl font-mono font-semibold">
                {formatearPrecio(ultimaVenta.total)}
              </p>
              {esFiado && ultimaVenta.clienteNombre && (
                <p className="text-sm text-neutral-500 mt-2">
                  {ultimaVenta.clienteNombre}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-neutral-400 font-mono">
            {ultimaVenta.numeroFactura}
            {ultimaVenta.remitoNumero && ` · Remito ${ultimaVenta.remitoNumero}`}
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={imprimirRemito}
              className="px-5 py-3 border border-neutral-300 rounded bg-white"
            >
              Imprimir remito{' '}
              <kbd className="ml-2 text-xs text-neutral-400">P</kbd>
            </button>
            <button
              onClick={() => setUltimaVenta(null)}
              className="px-6 py-3 bg-neutral-900 text-white rounded font-medium"
            >
              Siguiente cliente{' '}
              <kbd className="ml-2 text-xs text-neutral-400">Enter</kbd>
            </button>
          </div>
        </div>

        {imprimiendo && (
          <RemitoImprimible
            venta={ultimaVenta}
            sucursal={props.nombreSucursal}
            vendedor={props.nombreVendedor}
          />
        )}
      </>
    );
  }

  // ================================================================
  // Pantalla de venta
  // ================================================================

  return (
    <div className="grid grid-cols-[1fr_360px] gap-6 -mt-2">
      {/* Carrito */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            {catalogo.cantidad} artículos · caja abierta con{' '}
            {formatearPrecio(caja.efectivoInicial)}
          </span>
          <span className="flex items-center gap-3">
            {!online && <span className="text-amber-600">Sin conexión</span>}
            {enCola > 0 && (
              <span className="text-neutral-500">{enCola} por sincronizar</span>
            )}
          </span>
        </div>

        {aviso && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded px-4 py-2.5 text-sm">
            {aviso}
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded min-h-[24rem]">
          {carrito.items.length === 0 ? (
            <div className="py-24 text-center text-neutral-400">
              <p>Escaneá un artículo para empezar</p>
              <p className="text-sm mt-2">
                <kbd className="px-1.5 py-0.5 bg-neutral-100 rounded text-xs">
                  F4
                </kbd>{' '}
                para buscar por nombre
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-neutral-100">
                {carrito.items.map((item) => (
                  <tr
                    key={item.articuloId}
                    className={item.requiereCantidad ? 'bg-amber-50' : ''}
                  >
                    <td className="px-4 py-3">
                      <div>{item.nombre}</div>
                      <div className="text-xs text-neutral-500 font-mono">
                        {formatearPrecio(item.precioUnitario)}
                        {item.unidad !== 'unidad' && ` / ${item.unidad}`}
                      </div>
                    </td>

                    <td className="px-4 py-3 w-36">
                      {item.requiereCantidad ? (
                        <input
                          ref={inputPeso}
                          type="number"
                          step="0.001"
                          placeholder={item.unidad}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              engine.setCantidad(
                                item.articuloId,
                                Number(e.currentTarget.value),
                              );
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-full px-2 py-1 border border-amber-400 rounded text-right font-mono"
                        />
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              engine.setCantidad(item.articuloId, item.cantidad - 1)
                            }
                            className="w-6 h-6 rounded hover:bg-neutral-100"
                          >
                            −
                          </button>
                          <span className="w-14 text-center font-mono">
                            {item.unidad === 'unidad'
                              ? item.cantidad
                              : item.cantidad.toFixed(3)}
                          </span>
                          <button
                            onClick={() =>
                              engine.setCantidad(item.articuloId, item.cantidad + 1)
                            }
                            className="w-6 h-6 rounded hover:bg-neutral-100"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-mono w-28">
                      {formatearPrecio(item.subtotal)}
                    </td>

                    <td className="px-2 py-3 w-8">
                      <button
                        onClick={() => engine.quitar(item.articuloId)}
                        className="text-neutral-300 hover:text-red-600"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Panel de cobro */}
      <aside className="space-y-3">
        <div className="bg-white border border-neutral-200 rounded p-5">
          <div className="text-xs text-neutral-500 uppercase tracking-wide">
            Total
          </div>
          <div className="text-4xl font-mono font-semibold mt-1">
            {formatearPrecio(carrito.total)}
          </div>
          <div className="text-sm text-neutral-500 mt-1">
            {carrito.cantidadItems}{' '}
            {carrito.cantidadItems === 1 ? 'artículo' : 'artículos'}
          </div>
        </div>

        <div className="space-y-2">
          <BotonCobro
            tecla="F1"
            label="Efectivo"
            onClick={() => cobrar('efectivo')}
            disabled={carrito.items.length === 0}
            primario
          />
          <BotonCobro
            tecla="F2"
            label="POSNET"
            onClick={() => cobrar('posnet')}
            disabled={carrito.items.length === 0}
          />
          <BotonCobro
            tecla="F3"
            label="Billetera"
            onClick={() => cobrar('billetera')}
            disabled={carrito.items.length === 0}
          />
          <BotonCobro
            tecla="F5"
            label="Cuenta corriente"
            onClick={() => cobrar('cuenta_corriente')}
            disabled={carrito.items.length === 0}
          />
        </div>

        <button
          onClick={() => setBuscando(true)}
          className="w-full py-2.5 text-sm border border-neutral-300 rounded bg-white hover:bg-neutral-50 flex items-center justify-between px-4"
        >
          <span>Buscar artículo</span>
          <kbd className="text-xs text-neutral-400">F4</kbd>
        </button>

        <button
          onClick={() => engine.limpiar()}
          disabled={carrito.items.length === 0}
          className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
        >
          Cancelar venta <kbd className="text-xs">Esc</kbd>
        </button>

        <div className="pt-3 border-t border-neutral-200">
          <button
            onClick={() => setCerrando(true)}
            className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-900"
          >
            Cerrar caja
          </button>
        </div>
      </aside>

      {/* Modales */}
      {buscando && (
        <BuscadorArticulos
          onElegir={(id) => {
            engine.agregar(id);
            const avisoStock = engine.consumirAvisoStock();
            if (avisoStock) mostrarAviso(avisoStock);
            setBuscando(false);
          }}
          onCerrar={() => setBuscando(false)}
        />
      )}

      {pidiendoEfectivo && (
        <CobroEfectivo
          total={carrito.total}
          onConfirmar={(recibido) => ejecutarCobro('efectivo', recibido)}
          onCancelar={() => setPidiendoEfectivo(false)}
        />
      )}

      {eligiendoCliente && (
        <SelectorCliente
          total={carrito.total}
          onElegir={(cliente: ClienteLocal) =>
            ejecutarCobro('cuenta_corriente', undefined, {
              id: cliente.id,
              nombre: cliente.nombre,
            })
          }
          onCerrar={() => setEligiendoCliente(false)}
        />
      )}
    </div>
  );
}

function BotonCobro({
  tecla,
  label,
  onClick,
  disabled,
  primario,
}: {
  tecla: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  primario?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3.5 rounded font-medium flex items-center justify-between px-4 disabled:opacity-30 ${
        primario
          ? 'bg-neutral-900 text-white'
          : 'bg-white border border-neutral-300 hover:bg-neutral-50'
      }`}
    >
      <span>{label}</span>
      <kbd className="text-xs text-neutral-400">{tecla}</kbd>
    </button>
  );
}