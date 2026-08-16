'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCaja } from '@/hooks/useCaja';
import { useEscaner } from '@/hooks/useEscaner';
import { AperturaCaja } from './AperturaCaja';
import { CierreCaja } from './CierreCaja';
import { BuscadorArticulos } from './BuscadorArticulos';
import { CobroEfectivo } from './CobroEfectivo';
import { SelectorCliente } from './SelectorCliente';
import { VentaLibre } from './VentaLibre';
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
  const [ventaLibre, setVentaLibre] = useState(false);
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
      try {
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
      } catch {
        // El código escaneado es el del artículo genérico (000000)
        setVentaLibre(true);
      }
    },
    [engine, mostrarAviso],
  );

  const hayModal =
    buscando ||
    pidiendoEfectivo ||
    eligiendoCliente ||
    ventaLibre ||
    cerrando ||
    !!ultimaVenta;

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
      if (metodo === 'efectivo') {
        setPidiendoEfectivo(true);
        return;
      }
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
      if (
        pidiendoEfectivo ||
        eligiendoCliente ||
        ventaLibre ||
        buscando ||
        cerrando ||
        !caja
      ) {
        return;
      }

      if (e.key === 'F1') { e.preventDefault(); cobrar('efectivo'); }
      if (e.key === 'F2') { e.preventDefault(); cobrar('posnet'); }
      if (e.key === 'F3') { e.preventDefault(); cobrar('billetera'); }
      if (e.key === 'F4') { e.preventDefault(); setBuscando(true); }
      if (e.key === 'F5') { e.preventDefault(); cobrar('cuenta_corriente'); }
      if (e.key === 'F6') { e.preventDefault(); setVentaLibre(true); }
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
    ventaLibre,
    buscando,
    cerrando,
    caja,
  ]);

  // ================================================================
  // Estados previos a la venta
  // ================================================================

  if (buscandoCaja) {
    return <p className="py-24 text-center text-verde-claro">Cargando…</p>;
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
      <div className="py-24 text-center text-verde-claro">
        <p>Cargando catálogo…</p>
        <p className="text-sm mt-1 opacity-70">{infoCarga}</p>
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
        <div className="py-10 max-w-lg mx-auto">
          <div className="bg-verde-esmalte rounded-xl overflow-hidden shadow-xl">
            <div className="h-1.5 bg-ambar-dial" />

            <div className="px-8 py-10 text-center">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-tiza/70">
                {hayVuelto ? 'Vuelto' : esFiado ? 'Cargado a cuenta' : 'Cobrado'}
              </p>

              <p className="num text-7xl font-bold text-white leading-none mt-3">
                {formatearPrecio(hayVuelto ? ultimaVenta.vuelto! : ultimaVenta.total)}
              </p>

              {hayVuelto && (
                <p className="num text-sm text-tiza/70 mt-4">
                  Total {formatearPrecio(ultimaVenta.total)} · Recibido{' '}
                  {formatearPrecio(ultimaVenta.recibido ?? 0)}
                </p>
              )}

              {esFiado && ultimaVenta.clienteNombre && (
                <p className="text-sm text-tiza/70 mt-3">
                  {ultimaVenta.clienteNombre}
                </p>
              )}

              <p className="num text-xs text-tiza/50 mt-6">
                {ultimaVenta.numeroFactura}
                {ultimaVenta.remitoNumero && ` · Remito ${ultimaVenta.remitoNumero}`}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={imprimirRemito}
              className="flex-1 py-4 rounded-lg bg-mostrador ring-1 ring-tiza/60
                         hover:ring-verde-claro flex items-center justify-center gap-2"
            >
              Imprimir remito
              <kbd className="text-xs text-verde-claro">P</kbd>
            </button>
            <button
              onClick={() => setUltimaVenta(null)}
              className="flex-1 py-4 rounded-lg bg-verde-esmalte text-white font-medium
                         hover:bg-verde-hondo flex items-center justify-center gap-2"
            >
              Siguiente cliente
              <kbd className="text-xs text-tiza/60">Enter</kbd>
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
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 -mt-2">

      {/* ---------- Mostrador ---------- */}
      <div className="space-y-3">

        <div className="flex items-center justify-between text-xs">
          <span className="text-verde-claro">
            <span className="num">{catalogo.cantidad}</span> artículos · caja
            abierta con{' '}
            <span className="num">{formatearPrecio(caja.efectivoInicial)}</span>
          </span>

          <span className="flex items-center gap-3">
            {!online && (
              <span className="flex items-center gap-1.5 text-ambar-dial font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-ambar-dial" />
                Sin conexión
              </span>
            )}
            {enCola > 0 && (
              <span className="text-verde-claro">
                <span className="num">{enCola}</span> por sincronizar
              </span>
            )}
          </span>
        </div>

        {aviso && (
          <div className="bg-ambar-suave border-l-4 border-ambar-dial rounded-r px-4 py-2.5 text-sm">
            {aviso}
          </div>
        )}

        <div className="bg-mostrador rounded-lg overflow-hidden shadow-sm ring-1 ring-tiza/60 min-h-[26rem]">
          {carrito.items.length === 0 ? (
            <div className="py-28 text-center">
              <p className="text-4xl font-black tracking-tight text-tiza select-none">
                NAVARRETE
              </p>
              <p className="mt-6 text-verde-claro">
                Escaneá un artículo para empezar
              </p>
              <p className="mt-2 text-sm text-verde-claro/70">
                <kbd className="px-1.5 py-0.5 bg-papel rounded text-xs font-medium">
                  F4
                </kbd>{' '}
                para buscar por nombre
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {carrito.items.map((item, i) => (
                  <tr
                    key={item.lineaId}
                    className={
                      item.requiereCantidad
                        ? 'renglon-pesar'
                        : i % 2 === 0
                          ? 'renglon-impar'
                          : 'renglon-par'
                    }
                  >
                    <td className="px-4 py-3">
                      <div>
                        {item.nombre}
                        {item.esGenerico && (
                          <span className="ml-2 text-xs text-verde-claro">
                            venta libre
                          </span>
                        )}
                      </div>
                      <div className="num text-xs text-verde-claro mt-0.5">
                        {formatearPrecio(item.precioUnitario)}
                        {item.unidad !== 'unidad' && (
                          <span className="font-sans"> por {item.unidad}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 w-40">
                      {item.requiereCantidad ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ambar-dial font-medium whitespace-nowrap">
                            pesar
                          </span>
                          <input
                            ref={inputPeso}
                            type="number"
                            step="0.001"
                            placeholder={item.unidad}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                engine.setCantidad(
                                  item.lineaId,
                                  Number(e.currentTarget.value),
                                );
                                e.currentTarget.blur();
                              }
                            }}
                            className="num w-full px-2 py-1.5 rounded border-2 border-ambar-dial
                                       bg-mostrador text-right focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              engine.setCantidad(item.lineaId, item.cantidad - 1)
                            }
                            className="w-7 h-7 rounded hover:bg-papel text-verde-claro text-lg leading-none"
                            aria-label={`Quitar uno de ${item.nombre}`}
                          >
                            −
                          </button>
                          <span className="num w-14 text-center font-medium">
                            {item.unidad === 'unidad'
                              ? item.cantidad
                              : item.cantidad.toFixed(3)}
                          </span>
                          <button
                            onClick={() =>
                              engine.setCantidad(item.lineaId, item.cantidad + 1)
                            }
                            className="w-7 h-7 rounded hover:bg-papel text-verde-claro text-lg leading-none"
                            aria-label={`Agregar uno de ${item.nombre}`}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="num px-4 py-3 text-right font-medium w-32">
                      {formatearPrecio(item.subtotal)}
                    </td>

                    <td className="px-3 py-3 w-10">
                      <button
                        onClick={() => engine.quitar(item.lineaId)}
                        className="w-6 h-6 rounded text-tiza hover:text-rojo-plomo hover:bg-papel"
                        aria-label={`Quitar ${item.nombre}`}
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

      {/* ---------- Panel de cobro ---------- */}
      <aside className="space-y-2.5 lg:sticky lg:top-20 lg:self-start">

        {/* Visor */}
        <div className="bg-verde-esmalte rounded-lg overflow-hidden shadow-lg">
          <div
            className={`h-1 transition-colors ${
              carrito.hayPendientes ? 'bg-ambar-dial' : 'bg-verde-claro/40'
            }`}
          />

          <div className="px-5 pt-4 pb-5">
            <div className="text-[0.65rem] uppercase tracking-[0.18em] text-tiza/70">
              Total
            </div>

            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="num text-2xl text-tiza/60">$</span>
              <span className="num text-5xl font-bold text-white leading-none">
                {formatearPrecio(carrito.total).replace('$', '').trim()}
              </span>
            </div>

            <div className="text-xs text-tiza/70 mt-2">
              {carrito.cantidadItems === 0 ? (
                'Sin artículos'
              ) : (
                <>
                  <span className="num">{carrito.cantidadItems}</span>
                  {carrito.cantidadItems === 1 ? ' artículo' : ' artículos'}
                </>
              )}
              {carrito.hayPendientes && (
                <span className="text-ambar-dial"> · falta pesar</span>
              )}
            </div>
          </div>
        </div>

        {/* Cobro */}
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
            label="Tarjeta"
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

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setBuscando(true)}
            className="py-2.5 text-sm rounded-lg bg-mostrador ring-1 ring-tiza/60
                       hover:ring-verde-claro flex items-center justify-between px-3"
          >
            <span>Buscar</span>
            <kbd className="text-xs text-verde-claro">F4</kbd>
          </button>

          <button
            onClick={() => setVentaLibre(true)}
            className="py-2.5 text-sm rounded-lg bg-mostrador ring-1 ring-tiza/60
                       hover:ring-verde-claro flex items-center justify-between px-3"
          >
            <span>Venta libre</span>
            <kbd className="text-xs text-verde-claro">F6</kbd>
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => engine.limpiar()}
            disabled={carrito.items.length === 0}
            className="flex-1 py-2 text-xs text-verde-claro hover:text-rojo-plomo disabled:opacity-30"
          >
            Cancelar venta
          </button>
          <button
            onClick={() => setCerrando(true)}
            className="flex-1 py-2 text-xs text-verde-claro hover:text-verde-esmalte"
          >
            Cerrar caja
          </button>
        </div>
      </aside>

      {/* ---------- Modales ---------- */}
      {buscando && (
        <BuscadorArticulos
          onElegir={(id) => {
            try {
              engine.agregar(id);
              const avisoStock = engine.consumirAvisoStock();
              if (avisoStock) mostrarAviso(avisoStock);
            } catch {
              setVentaLibre(true);
            }
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

      {ventaLibre && (
        <VentaLibre
          onConfirmar={(descripcion, precio, cantidad) => {
            try {
              engine.agregarLibre(descripcion, precio, cantidad);
            } catch (e) {
              mostrarAviso(
                e instanceof Error ? e.message : 'No se pudo agregar',
              );
            }
            setVentaLibre(false);
          }}
          onCerrar={() => setVentaLibre(false)}
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
      className={`w-full py-4 lg:py-3.5 rounded-lg font-medium flex items-center
                  justify-between px-4 transition disabled:opacity-30 ${
        primario
          ? 'bg-verde-esmalte text-white hover:bg-verde-hondo shadow-sm'
          : 'bg-mostrador ring-1 ring-tiza/60 hover:ring-verde-claro'
      }`}
    >
      <span>{label}</span>
      <kbd className={`text-xs ${primario ? 'text-tiza/60' : 'text-verde-claro'}`}>
        {tecla}
      </kbd>
    </button>
  );
}