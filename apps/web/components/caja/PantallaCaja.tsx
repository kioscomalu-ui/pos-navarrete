'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCaja } from '@/hooks/useCaja';
import { useEscaner } from '@/hooks/useEscaner';
import { reintentarTodo } from '@/lib/cola-sync';
import { catalogo } from '@/lib/catalogo-cache';
import { AperturaCaja } from './AperturaCaja';
import { CierreCaja } from './CierreCaja';
import { BuscadorArticulos } from './BuscadorArticulos';
import { CobroEfectivo } from './CobroEfectivo';
import { SelectorCliente } from './SelectorCliente';
import { VentaLibre } from './VentaLibre';
import { CobroMixto } from './CobroMixto';
import { EscanerCamara } from './EscanerCamara';
import { ModalPagoProveedor } from './ModalPagoProveedor';
import { ModalTransferenciaCaja } from './ModalTransferenciaCaja';
import { ModalMontoServicio } from './ModalMontoServicio';
import { ModalRetiroCaja } from './ModalRetiroCaja';
import { VentasDelDia } from './VentasDelDia';
import { RemitoImprimible } from './RemitoImprimible';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import type { DesglosePago } from '@/lib/venta-engine';
import type { VentaLocal, ClienteLocal } from '@/lib/db-local';
import type { RolUsuario } from '@pos/shared/types';

interface Props {
  sucursalId: string;
  vendedorId: string;
  codigoSucursal: string;
  nombreSucursal: string;
  nombreVendedor: string;
  puntoVenta: number;
  umbralDiferencia: number;
  rol: RolUsuario;
}

interface ArticuloServicio {
  id: string;
  nombre: string;
  comisionPorcentaje: number | null;
  comisionSobreMonto: boolean;
}

export function PantallaCaja(props: Props) {
  const {
    engine,
    carrito,
    listo,
    infoCarga,
    online,
    enCola,
    catalogo: catalogoInfo,
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
  const [pagoMixto, setPagoMixto] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [pagandoProveedor, setPagandoProveedor] = useState(false);
  const [transfiriendo, setTransfiriendo] = useState(false);
  const [retirando, setRetirando] = useState(false);
  const [viendoVentas, setViendoVentas] = useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] =
    useState<ArticuloServicio | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState<VentaLocal | null>(null);
  const inputPeso = useRef<HTMLInputElement>(null);

  const puedeMoverEfectivo = props.rol === 'admin' || props.rol === 'gerente';

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(''), 2500);
  }, []);

  const forzarReintento = useCallback(async () => {
    setReintentando(true);
    try {
      const r = await reintentarTodo();
      if (r.enviadas > 0) {
        mostrarAviso(
          `${r.enviadas} ${r.enviadas === 1 ? 'venta sincronizada' : 'ventas sincronizadas'}`,
        );
      } else if (r.fallidas > 0) {
        mostrarAviso('Sigue sin poder sincronizar. Revisá la conexión.');
      } else {
        mostrarAviso('Todo estaba al día');
      }
    } finally {
      setReintentando(false);
    }
  }, [mostrarAviso]);

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
      } catch (e) {
        if (e instanceof Error && e.message === 'SERVICIO_COMISION') {
          const art = catalogo.porCodigo(codigo);
          if (art) {
            setServicioSeleccionado({
              id: art.id,
              nombre: art.nombre,
              comisionPorcentaje: art.comisionPorcentaje,
              comisionSobreMonto: art.comisionSobreMonto,
            });
          }
          return;
        }
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
    pagoMixto ||
    escaneando ||
    pagandoProveedor ||
    transfiriendo ||
    retirando ||
    viendoVentas ||
    !!servicioSeleccionado ||
    cerrando ||
    !!ultimaVenta;

  useEscaner(alEscanear, listo && !!caja && !hayModal);

  const ejecutarCobro = useCallback(
    async (
      pagos: DesglosePago[],
      recibidoEfectivo?: number,
      cliente?: { id: string; nombre: string },
    ) => {
      try {
        const venta = await engine.cobrar(pagos, recibidoEfectivo, cliente);
        setUltimaVenta(venta);
        setPidiendoEfectivo(false);
        setEligiendoCliente(false);
        setPagoMixto(false);
      } catch (e) {
        mostrarAviso(e instanceof Error ? e.message : 'Error al cobrar');
      }
    },
    [engine, mostrarAviso],
  );

  const cobrar = useCallback(
    (metodo: 'efectivo' | 'posnet' | 'billetera' | 'cuenta_corriente') => {
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
      void ejecutarCobro([{ metodo, monto: carrito.total }]);
    },
    [carrito, ejecutarCobro, mostrarAviso],
  );

  const alConfirmarMovimiento = useCallback(
    (mensaje: string) => {
      setPagandoProveedor(false);
      setTransfiriendo(false);
      setRetirando(false);
      mostrarAviso(mensaje);
    },
    [mostrarAviso],
  );

   const imprimirRemito = useCallback(async () => {
    if (!ultimaVenta) return;
    try {
      const numero = await engine.emitirRemito(ultimaVenta.id);
      setUltimaVenta({ ...ultimaVenta, remitoNumero: numero });
      setImprimiendo(true);
    } catch {
      mostrarAviso('No se pudo emitir el remito');
    }
  }, [ultimaVenta, engine, mostrarAviso]);

  // Imprimir recién cuando el remito está pintado en el DOM. Con un
  // setTimeout fijo, window.print() a veces corría antes de que React
  // lo dibujara y la hoja salía en blanco.
  useEffect(() => {
    if (!imprimiendo) return;

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setImprimiendo(false);
      });
    });

    return () => cancelAnimationFrame(id);
  }, [imprimiendo]);

  
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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

      if (
        pidiendoEfectivo ||
        eligiendoCliente ||
        ventaLibre ||
        pagoMixto ||
        escaneando ||
        pagandoProveedor ||
        transfiriendo ||
        retirando ||
        viendoVentas ||
        servicioSeleccionado ||
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
      if (e.key === 'F7') { e.preventDefault(); setPagoMixto(true); }
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
    pagoMixto,
    escaneando,
    pagandoProveedor,
    transfiriendo,
    retirando,
    viendoVentas,
    servicioSeleccionado,
    buscando,
    cerrando,
    caja,
  ]);

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

  if (ultimaVenta) {
    const hayVuelto = ultimaVenta.vuelto != null && ultimaVenta.vuelto > 0;
    const esFiado = ultimaVenta.metodoPago === 'cuenta_corriente';
    const esMixto = ultimaVenta.metodoPago === 'mixto';

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

              {esMixto && ultimaVenta.pagos && (
                <div className="mt-4 space-y-1">
                  {ultimaVenta.pagos.map((p) => (
                    <p key={p.metodo} className="num text-sm text-tiza/70">
                      {etiquetaMetodo(p.metodo)} · {formatearPrecio(p.monto)}
                    </p>
                  ))}
                </div>
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 -mt-2">

      <div className="space-y-3">

        <div className="flex items-center justify-between text-xs">
          <span className="text-verde-claro">
            <span className="num">{catalogoInfo.cantidad}</span> artículos · caja
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
              <span className="flex items-center gap-1.5">
                <span className="text-verde-claro">
                  <span className="num">{enCola}</span> por sincronizar
                </span>
                <button
                  onClick={forzarReintento}
                  disabled={reintentando}
                  className="text-verde-claro underline hover:text-verde-esmalte disabled:opacity-50"
                >
                  {reintentando ? 'reintentando…' : 'reintentar'}
                </button>
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
                        {item.esServicio && (
                          <span className="ml-2 text-xs text-verde-claro">
                            servicio
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
                      ) : item.esServicio ? (
                        <div className="text-right text-xs text-verde-claro/70">
                          1
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

      <aside className="space-y-2.5 lg:sticky lg:top-20 lg:self-start">

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
          <BotonCobro
            tecla="F7"
            label="Pago combinado"
            onClick={() => setPagoMixto(true)}
            disabled={carrito.items.length === 0}
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setBuscando(true)}
            className="py-2.5 text-sm rounded-lg bg-mostrador ring-1 ring-tiza/60
                       hover:ring-verde-claro"
          >
            Buscar
          </button>

          <button
            onClick={() => setEscaneando(true)}
            className="py-2.5 text-sm rounded-lg bg-mostrador ring-1 ring-tiza/60
                       hover:ring-verde-claro"
          >
            Cámara
          </button>

          <button
            onClick={() => setVentaLibre(true)}
            className="py-2.5 text-sm rounded-lg bg-mostrador ring-1 ring-tiza/60
                       hover:ring-verde-claro"
          >
            Libre
          </button>

          <button
            onClick={() => setRetirando(true)}
            className="py-2.5 text-sm rounded-lg bg-mostrador ring-1 ring-tiza/60
                       hover:ring-verde-claro"
          >
            Retirar
          </button>
        </div>

        {puedeMoverEfectivo && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setPagandoProveedor(true)}
              className="py-2.5 text-sm rounded-lg bg-mostrador ring-1 ring-tiza/60
                         hover:ring-verde-claro"
            >
              Pagar proveedor
            </button>
            <button
              onClick={() => setTransfiriendo(true)}
              className="py-2.5 text-sm rounded-lg bg-mostrador ring-1 ring-tiza/60
                         hover:ring-verde-claro"
            >
              Transferir a caja
            </button>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => engine.limpiar()}
            disabled={carrito.items.length === 0}
            className="flex-1 py-2 text-xs text-verde-claro hover:text-rojo-plomo disabled:opacity-30"
          >
            Cancelar venta
          </button>
          <button
            onClick={() => setViendoVentas(true)}
            className="flex-1 py-2 text-xs text-verde-claro hover:text-verde-esmalte"
          >
            Ventas de hoy
          </button>
          <button
            onClick={() => setCerrando(true)}
            className="flex-1 py-2 text-xs text-verde-claro hover:text-verde-esmalte"
          >
            Cerrar caja
          </button>
        </div>
      </aside>

      {buscando && (
        <BuscadorArticulos
          onElegir={(id) => {
            try {
              engine.agregar(id);
              const avisoStock = engine.consumirAvisoStock();
              if (avisoStock) mostrarAviso(avisoStock);
            } catch (e) {
              if (e instanceof Error && e.message === 'SERVICIO_COMISION') {
                const art = catalogo.obtener(id);
                if (art) {
                  setServicioSeleccionado({
                    id: art.id,
                    nombre: art.nombre,
                    comisionPorcentaje: art.comisionPorcentaje,
                    comisionSobreMonto: art.comisionSobreMonto,
                  });
                }
              } else {
                setVentaLibre(true);
              }
            }
            setBuscando(false);
          }}
          onCerrar={() => setBuscando(false)}
        />
      )}

      {escaneando && (
        <EscanerCamara
          onCodigo={(codigo) => {
            setEscaneando(false);
            alEscanear(codigo);
          }}
          onCerrar={() => setEscaneando(false)}
        />
      )}

      {pidiendoEfectivo && (
        <CobroEfectivo
          total={carrito.total}
          onConfirmar={(recibido) =>
            ejecutarCobro([{ metodo: 'efectivo', monto: carrito.total }], recibido)
          }
          onCancelar={() => setPidiendoEfectivo(false)}
        />
      )}

      {eligiendoCliente && (
        <SelectorCliente
          total={carrito.total}
          onElegir={(cliente: ClienteLocal) =>
            ejecutarCobro(
              [{ metodo: 'cuenta_corriente', monto: carrito.total }],
              undefined,
              { id: cliente.id, nombre: cliente.nombre },
            )
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

      {pagoMixto && (
        <CobroMixto
          total={carrito.total}
          onConfirmar={(pagos, recibido) => ejecutarCobro(pagos, recibido)}
          onCancelar={() => setPagoMixto(false)}
        />
      )}

      {pagandoProveedor && (
        <ModalPagoProveedor
          cajaId={caja.id}
          onConfirmar={() => alConfirmarMovimiento('Pago registrado')}
          onCancelar={() => setPagandoProveedor(false)}
        />
      )}

      {transfiriendo && (
        <ModalTransferenciaCaja
          cajaId={caja.id}
          onConfirmar={() => alConfirmarMovimiento('Transferencia registrada')}
          onCancelar={() => setTransfiriendo(false)}
        />
      )}

      {retirando && (
        <ModalRetiroCaja
          cajaId={caja.id}
          onConfirmar={() => alConfirmarMovimiento('Retiro registrado')}
          onCancelar={() => setRetirando(false)}
        />
      )}

      {viendoVentas && (
        <VentasDelDia
          nombreSucursal={props.nombreSucursal}
          nombreVendedor={props.nombreVendedor}
          onEmitirRemito={(ventaId) => engine.emitirRemito(ventaId)}
          onCerrar={() => setViendoVentas(false)}
        />
      )}

      {servicioSeleccionado && (
        <ModalMontoServicio
          articulo={servicioSeleccionado}
          onConfirmar={(monto) => {
            try {
              engine.agregarServicio(servicioSeleccionado.id, monto);
            } catch (e) {
              mostrarAviso(
                e instanceof Error ? e.message : 'No se pudo agregar',
              );
            }
            setServicioSeleccionado(null);
          }}
          onCancelar={() => setServicioSeleccionado(null)}
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

function etiquetaMetodo(m: string): string {
  const mapa: Record<string, string> = {
    efectivo: 'Efectivo',
    posnet: 'Tarjeta',
    billetera: 'Billetera',
    cuenta_corriente: 'Cta. corriente',
  };
  return mapa[m] ?? m;
}