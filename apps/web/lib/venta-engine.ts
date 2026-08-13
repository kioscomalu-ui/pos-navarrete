import Decimal from 'decimal.js';
import { catalogo } from './catalogo-cache';
import {
  dbLocal,
  siguienteNumero,
  type ItemVentaLocal,
  type VentaLocal,
} from './db-local';
import { encolar } from './cola-sync';
import type { MetodoPago } from '@pos/shared/types';

export interface ItemCarrito extends ItemVentaLocal {
  /** Artículos por peso: true hasta que se ingrese la cantidad */
  requiereCantidad: boolean;
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

  /** Aviso de stock insuficiente, para que la pantalla lo muestre */
  private avisoStock: string | null = null;

  constructor(
    private sucursalId: string,
    private vendedorId: string,
    private codigoSucursal: string,
    private puntoVenta: number,
  ) {}

  // ------------------------------------------------------------------
  // Camino crítico: sincrónico, sin red
  // ------------------------------------------------------------------

  escanear(codigo: string):
    | { ok: true; item: ItemCarrito; nuevo: boolean }
    | { ok: false; codigo: string } {

    const articulo = catalogo.porCodigo(codigo);
    if (!articulo) return { ok: false, codigo };

    return { ok: true, ...this.agregar(articulo.id) };
  }

  agregar(articuloId: string): { item: ItemCarrito; nuevo: boolean } {
    const articulo = catalogo.obtener(articuloId);
    if (!articulo) throw new Error('Artículo no encontrado en el catálogo');

    const existente = this.items.get(articuloId);
    const porPeso = articulo.unidad !== 'unidad';

    // Aviso de stock: no bloquea, el stock del sistema puede estar viejo
    if (!porPeso) {
      const disponible = catalogo.stockDe(articuloId);
      const enCarrito = existente?.cantidad ?? 0;
      if (enCarrito + 1 > disponible) {
        this.avisoStock = `Stock insuficiente de ${articulo.nombre} (quedan ${disponible})`;
      }
    }

    // Ya estaba en el carrito
    if (existente) {
      if (!porPeso) {
        existente.cantidad += 1;
        existente.subtotal = this.subtotalDe(existente);
      }
      this.emitir();
      return { item: existente, nuevo: false };
    }

    const item: ItemCarrito = {
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

    this.items.set(articulo.id, item);
    this.emitir();
    return { item, nuevo: true };
  }

  setCantidad(articuloId: string, cantidad: number) {
    const item = this.items.get(articuloId);
    if (!item) return;

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      this.items.delete(articuloId);
    } else {
      item.cantidad = cantidad;
      item.requiereCantidad = false;
      item.subtotal = this.subtotalDe(item);
    }
    this.emitir();
  }

  setDescuento(articuloId: string, porcentaje: number) {
    const item = this.items.get(articuloId);
    if (!item) return;

    item.descuentoPorcentaje = Math.max(0, Math.min(100, porcentaje));
    item.subtotal = this.subtotalDe(item);
    this.emitir();
  }

  quitar(articuloId: string) {
    this.items.delete(articuloId);
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

  /** Devuelve el aviso pendiente y lo limpia */
  consumirAvisoStock(): string | null {
    const aviso = this.avisoStock;
    this.avisoStock = null;
    return aviso;
  }

  // ------------------------------------------------------------------
  // Cobro
  // ------------------------------------------------------------------

  /**
   * Cierra la venta: escribe local y encola para sincronizar.
   * `cliente` solo se usa cuando el pago es a cuenta corriente.
   */
  async cobrar(
    metodoPago: MetodoPago,
    recibido?: number,
    cliente?: ClienteVenta,
  ): Promise<VentaLocal> {
    const items = [...this.items.values()];
    if (items.length === 0) throw new Error('No hay artículos para cobrar');

    const pendiente = items.find((i) => i.requiereCantidad || i.cantidad <= 0);
    if (pendiente) throw new Error(`Falta la cantidad de ${pendiente.nombre}`);

    if (metodoPago === 'cuenta_corriente' && !cliente) {
      throw new Error('Elegí un cliente para cargar a cuenta corriente');
    }

    const subtotal = items.reduce(
      (acc, i) => acc.plus(new Decimal(i.precioUnitario).times(i.cantidad)),
      new Decimal(0),
    );
    const total = items.reduce((acc, i) => acc.plus(i.subtotal), new Decimal(0));

    const venta: VentaLocal = {
      id: crypto.randomUUID(),
      numeroFactura: await this.numeroFactura(),
      fecha: new Date().toISOString(),
      sucursalId: this.sucursalId,
      vendedorId: this.vendedorId,
      clienteId: cliente?.id ?? null,
      clienteNombre: cliente?.nombre ?? null,
      items: items.map(({ requiereCantidad, ...resto }) => resto),
      subtotal: subtotal.toDecimalPlaces(2).toNumber(),
      descuentoTotal: subtotal.minus(total).toDecimalPlaces(2).toNumber(),
      total: total.toDecimalPlaces(2).toNumber(),
      recibido: recibido ?? null,
      vuelto:
        recibido != null
          ? new Decimal(recibido).minus(total).toDecimalPlaces(2).toNumber()
          : null,
      metodoPago,
      remitoNumero: null,
      syncedAt: null,
    };

    await dbLocal.ventas.put(venta);

    // Descontar stock: en memoria (inmediato) y en la base local
    for (const item of items) {
      catalogo.descontar(item.articuloId, item.cantidad);

      const actual = await dbLocal.stock.get(item.articuloId);
      if (actual) {
        await dbLocal.stock.put({
          articuloId: item.articuloId,
          cantidad: actual.cantidad - item.cantidad,
        });
      }
    }

    // Venta fiada: actualizar el saldo local del cliente.
    // En el servidor lo hace el trigger; acá hace falta para que el
    // cobrador no salga a la calle con el saldo de ayer.
    if (metodoPago === 'cuenta_corriente' && cliente) {
      const local = await dbLocal.clientes.get(cliente.id);
      if (local) {
        await dbLocal.clientes.update(cliente.id, {
          saldo: new Decimal(local.saldo)
            .plus(venta.total)
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

  // ------------------------------------------------------------------
  // Remito
  // ------------------------------------------------------------------

  /**
   * Numera y marca el remito. Local, sin red.
   * Si ya se emitió devuelve el mismo número: una reimpresión
   * no consume un número nuevo del talonario.
   */
  async emitirRemito(ventaId: string): Promise<string> {
    const venta = await dbLocal.ventas.get(ventaId);
    if (!venta) throw new Error('Venta no encontrada');
    if (venta.remitoNumero) return venta.remitoNumero;

    const n = await siguienteNumero(`remito:${this.puntoVenta}`);
    const numero =
      `${String(this.puntoVenta).padStart(4, '0')}-${String(n).padStart(8, '0')}`;

    await dbLocal.ventas.update(ventaId, { remitoNumero: numero });

    // Reencolar para que el número llegue al servidor.
    // El RPC es idempotente: si la venta ya subió, solo actualiza el remito.
    await encolar('venta', { ...venta, remitoNumero: numero });

    return numero;
  }

  // ------------------------------------------------------------------
  // Internos
  // ------------------------------------------------------------------

  /** SUC01-20260813-000147 — contador local, sin consultar al servidor */
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

  // ------------------------------------------------------------------
  // Suscripción
  // ------------------------------------------------------------------

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