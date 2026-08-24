import Decimal from 'decimal.js';
import { catalogo } from './catalogo-cache';
import {
  dbLocal,
  siguienteNumero,
  type ItemVentaLocal,
  type VentaLocal,
} from './db-local';
import { encolar } from './cola-sync';

export interface DesglosePago {
  metodo: 'efectivo' | 'posnet' | 'billetera' | 'cuenta_corriente';
  monto: number;
}

export interface ItemCarrito extends ItemVentaLocal {
  requiereCantidad: boolean;
  lineaId: string;
}

export interface EstadoCarrito {
  items: ItemCarrito[];
  cantidadItems: number;
  subtotal: number;
  total: number;
  hayPendientes: boolean;
}

export interface ClienteVenta {
  id: string;
  nombre: string;
}

type Escucha = (estado: EstadoCarrito) => void;

export class VentaEngine {
  private items = new Map<string, ItemCarrito>();
  private escuchas = new Set<Escucha>();
  private avisoStock: string | null = null;

  constructor(
    private sucursalId: string,
    private vendedorId: string,
    private codigoSucursal: string,
    private puntoVenta: number,
  ) {}

  escanear(codigo: string):
    | { ok: true; item: ItemCarrito; nuevo: boolean }
    | { ok: false; codigo: string } {

    const articulo = catalogo.porCodigo(codigo);
    if (!articulo) return { ok: false, codigo };

    return { ok: true, ...this.agregar(articulo.id) };
  }

  /**
   * Agrega un artículo del catálogo. Los genéricos (venta libre) y
   * los de servicio con comisión tiran error para que la pantalla
   * abra el cuadro correspondiente en su lugar — ninguno tiene un
   * precio fijo que este método pueda usar.
   */
  agregar(articuloId: string): { item: ItemCarrito; nuevo: boolean } {
    const articulo = catalogo.obtener(articuloId);
    if (!articulo) throw new Error('Artículo no encontrado en el catálogo');

    if (articulo.esGenerico) {
      throw new Error('Usá "Venta libre" para cargar este tipo de artículo');
    }

    if (articulo.esServicioComision) {
      throw new Error('SERVICIO_COMISION');
    }

    const existente = this.items.get(articuloId);
    const porPeso = articulo.unidad !== 'unidad';

    if (!porPeso) {
      const disponible = catalogo.stockDe(articuloId);
      const enCarrito = existente?.cantidad ?? 0;
      if (enCarrito + 1 > disponible) {
        this.avisoStock = `Stock insuficiente de ${articulo.nombre} (quedan ${disponible})`;
      }
    }

    if (existente) {
      if (!porPeso) {
        existente.cantidad += 1;
        existente.subtotal = this.subtotalDe(existente);
      }
      this.emitir();
      return { item: existente, nuevo: false };
    }

    const item: ItemCarrito = {
      lineaId: articulo.id,
      articuloId: articulo.id,
      nombre: articulo.nombre,
      unidad: articulo.unidad,
      cantidad: porPeso ? 0 : 1,
      precioUnitario: articulo.precioVentaFinal,
      descuentoPorcentaje: 0,
      subtotal: porPeso ? 0 : articulo.precioVentaFinal,
      costoUnitarioSnapshot: articulo.costoUnitario,
      requiereCantidad: porPeso,
    };

    this.items.set(item.lineaId, item);
    this.emitir();
    return { item, nuevo: true };
  }

  agregarLibre(
    descripcion: string,
    precioUnitario: number,
    cantidad = 1,
  ): ItemCarrito {
    const generico = catalogo.obtenerGenerico();
    if (!generico) {
      throw new Error('El artículo de venta libre no está configurado');
    }

    const texto = descripcion.trim() || 'Artículo varios';
    const monto = Math.max(0, precioUnitario);
    const cant = Math.max(0.001, cantidad);

    const item: ItemCarrito = {
      lineaId: `libre:${crypto.randomUUID()}`,
      articuloId: generico.id,
      nombre: texto,
      unidad: 'unidad',
      cantidad: cant,
      precioUnitario: monto,
      descuentoPorcentaje: 0,
      subtotal: new Decimal(monto).times(cant).toDecimalPlaces(2).toNumber(),
      costoUnitarioSnapshot: 0,
      requiereCantidad: false,
      esGenerico: true,
    };

    this.items.set(item.lineaId, item);
    this.emitir();
    return item;
  }

  /**
   * Quiniela, recargas de celular, etc: el cliente dice cuánto juega
   * o carga, el sistema calcula solo cuánto de eso es ganancia según
   * la comisión cargada en el artículo. El resto —lo que hay que
   * rendir a la agencia o distribuidora— queda en el costo de la
   * línea, así los reportes de margen ya muestran la ganancia real
   * sin ningún cálculo aparte. No descuenta stock.
   */
  agregarServicio(articuloId: string, monto: number): ItemCarrito {
    const articulo = catalogo.obtener(articuloId);
    if (!articulo) throw new Error('Artículo no encontrado en el catálogo');
    if (!articulo.esServicioComision) {
      throw new Error('Este artículo no está configurado como servicio con comisión');
    }

    const m = Math.max(0, monto);
    const comision = articulo.comisionPorcentaje ?? 0;

    const costo = new Decimal(m)
      .times(new Decimal(100).minus(comision))
      .div(100)
      .toDecimalPlaces(2)
      .toNumber();

    const item: ItemCarrito = {
      lineaId: `servicio:${crypto.randomUUID()}`,
      articuloId: articulo.id,
      nombre: articulo.nombre,
      unidad: 'unidad',
      cantidad: 1,
      precioUnitario: m,
      descuentoPorcentaje: 0,
      subtotal: m,
      costoUnitarioSnapshot: costo,
      requiereCantidad: false,
      esServicio: true,
    };

    this.items.set(item.lineaId, item);
    this.emitir();
    return item;
  }

  setCantidad(lineaId: string, cantidad: number) {
    const item = this.items.get(lineaId);
    if (!item) return;

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      this.items.delete(lineaId);
    } else {
      item.cantidad = cantidad;
      item.requiereCantidad = false;
      item.subtotal = this.subtotalDe(item);
    }
    this.emitir();
  }

  setDescuento(lineaId: string, porcentaje: number) {
    const item = this.items.get(lineaId);
    if (!item) return;

    item.descuentoPorcentaje = Math.max(0, Math.min(100, porcentaje));
    item.subtotal = this.subtotalDe(item);
    this.emitir();
  }

  quitar(lineaId: string) {
    this.items.delete(lineaId);
    this.emitir();
  }

  quitarUltimo() {
    const ultimo = [...this.items.keys()].pop();
    if (ultimo) this.quitar(ultimo);
  }

  limpiar() {
    this.items.clear();
    this.avisoStock = null;
    this.emitir();
  }

  consumirAvisoStock(): string | null {
    const aviso = this.avisoStock;
    this.avisoStock = null;
    return aviso;
  }

  async cobrar(
    pagos: DesglosePago[],
    recibidoEfectivo?: number,
    cliente?: ClienteVenta,
  ): Promise<VentaLocal> {
    const items = [...this.items.values()];
    if (items.length === 0) throw new Error('No hay artículos para cobrar');

    const pendiente = items.find((i) => i.requiereCantidad || i.cantidad <= 0);
    if (pendiente) throw new Error(`Falta la cantidad de ${pendiente.nombre}`);

    if (pagos.length === 0) throw new Error('Falta indicar cómo se cobra');

    const total = items.reduce((acc, i) => acc.plus(i.subtotal), new Decimal(0));
    const sumaPagos = pagos.reduce(
      (acc, p) => acc.plus(p.monto),
      new Decimal(0),
    );

    if (sumaPagos.minus(total).abs().greaterThan(0.01)) {
      throw new Error(
        `Los pagos suman ${sumaPagos.toFixed(2)} y el total es ${total.toFixed(2)}`,
      );
    }

    const usaCuentaCorriente = pagos.some((p) => p.metodo === 'cuenta_corriente');
    if (usaCuentaCorriente && !cliente) {
      throw new Error('Elegí un cliente para la parte a cuenta corriente');
    }

    const metodoPago = pagos.length === 1 ? pagos[0].metodo : 'mixto';
    const subtotal = items.reduce(
      (acc, i) => acc.plus(new Decimal(i.precioUnitario).times(i.cantidad)),
      new Decimal(0),
    );

    const parteEfectivo = pagos.find((p) => p.metodo === 'efectivo');

    const venta: VentaLocal = {
      id: crypto.randomUUID(),
      numeroFactura: await this.numeroFactura(),
      fecha: new Date().toISOString(),
      sucursalId: this.sucursalId,
      vendedorId: this.vendedorId,
      clienteId: cliente?.id ?? null,
      clienteNombre: cliente?.nombre ?? null,
      items: items.map(({ requiereCantidad, lineaId, ...resto }) => resto),
      subtotal: subtotal.toDecimalPlaces(2).toNumber(),
      descuentoTotal: subtotal.minus(total).toDecimalPlaces(2).toNumber(),
      total: total.toDecimalPlaces(2).toNumber(),
      recibido: recibidoEfectivo ?? null,
      vuelto:
        recibidoEfectivo != null
          ? new Decimal(recibidoEfectivo)
              .minus(parteEfectivo?.monto ?? 0)
              .toDecimalPlaces(2)
              .toNumber()
          : null,
      metodoPago,
      pagos,
      remitoNumero: null,
      syncedAt: null,
    };

    await dbLocal.ventas.put(venta);

    for (const item of items) {
      if (item.esGenerico || item.esServicio) continue;

      catalogo.descontar(item.articuloId, item.cantidad);

      const actual = await dbLocal.stock.get(item.articuloId);
      if (actual) {
        await dbLocal.stock.put({
          articuloId: item.articuloId,
          cantidad: actual.cantidad - item.cantidad,
        });
      }
    }

    const parteCtaCte = pagos.find((p) => p.metodo === 'cuenta_corriente');
    if (parteCtaCte && cliente) {
      const local = await dbLocal.clientes.get(cliente.id);
      if (local) {
        await dbLocal.clientes.update(cliente.id, {
          saldo: new Decimal(local.saldo)
            .plus(parteCtaCte.monto)
            .toDecimalPlaces(2)
            .toNumber(),
        });
      }
    }

    await encolar('venta', venta);

    this.items.clear();
    this.avisoStock = null;
    this.emitir();

    return venta;
  }

  async emitirRemito(ventaId: string): Promise<string> {
    const venta = await dbLocal.ventas.get(ventaId);
    if (!venta) throw new Error('Venta no encontrada');
    if (venta.remitoNumero) return venta.remitoNumero;

    const n = await siguienteNumero(`remito:${this.puntoVenta}`);
    const numero =
      `${String(this.puntoVenta).padStart(4, '0')}-${String(n).padStart(8, '0')}`;

    await dbLocal.ventas.update(ventaId, { remitoNumero: numero });
    await encolar('venta', { ...venta, remitoNumero: numero });

    return numero;
  }

  private async numeroFactura(): Promise<string> {
    const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const n = await siguienteNumero(`factura:${this.codigoSucursal}:${hoy}`);
    return `${this.codigoSucursal}-${hoy}-${String(n).padStart(6, '0')}`;
  }

  private subtotalDe(item: ItemCarrito): number {
    const bruto = new Decimal(item.precioUnitario).times(item.cantidad);
    const descuento = bruto.times(item.descuentoPorcentaje).div(100);
    return bruto.minus(descuento).toDecimalPlaces(2).toNumber();
  }

  suscribir(fn: Escucha): () => void {
    this.escuchas.add(fn);
    fn(this.estado());
    return () => {
      this.escuchas.delete(fn);
    };
  }

  estado(): EstadoCarrito {
    const items = [...this.items.values()];

    const subtotal = items.reduce(
      (acc, i) => acc.plus(new Decimal(i.precioUnitario).times(i.cantidad)),
      new Decimal(0),
    );
    const total = items.reduce((acc, i) => acc.plus(i.subtotal), new Decimal(0));

    return {
      items,
      cantidadItems: items.length,
      subtotal: subtotal.toDecimalPlaces(2).toNumber(),
      total: total.toDecimalPlaces(2).toNumber(),
      hayPendientes: items.some((i) => i.requiereCantidad),
    };
  }

  private emitir() {
    const estado = this.estado();
    for (const fn of this.escuchas) fn(estado);
  }
}