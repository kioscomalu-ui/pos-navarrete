import { dbLocal, type ArticuloLocal } from './db-local';

/**
 * Catálogo en memoria con índices precalculados.
 * Se carga al abrir caja y no se vuelve a consultar durante la venta.
 */
class CatalogoCache {
  private porCodigoBarras = new Map<string, ArticuloLocal>();
  private porCodigoInterno = new Map<string, ArticuloLocal>();
  private porId = new Map<string, ArticuloLocal>();
  private indice: Array<{ texto: string; articulo: ArticuloLocal }> = [];
  private stock = new Map<string, number>();

  cargado = false;

  cargar(articulos: ArticuloLocal[], stock: { articuloId: string; cantidad: number }[]) {
    this.porCodigoBarras.clear();
    this.porCodigoInterno.clear();
    this.porId.clear();
    this.stock.clear();
    this.indice = [];

    for (const a of articulos) {
      if (!a.activo) continue;
      this.porId.set(a.id, a);
      if (a.codigoBarras) this.porCodigoBarras.set(a.codigoBarras, a);
      if (a.codigoInterno) this.porCodigoInterno.set(a.codigoInterno, a);
      this.indice.push({ texto: normalizar(a.nombre), articulo: a });
    }

    for (const s of stock) this.stock.set(s.articuloId, s.cantidad);

    this.cargado = true;
  }

  /** Camino crítico del escáner: O(1) */
  porCodigo(codigo: string): ArticuloLocal | null {
    return this.porCodigoBarras.get(codigo)
        ?? this.porCodigoInterno.get(codigo)
        ?? null;
  }

  obtener(id: string) {
    return this.porId.get(id) ?? null;
  }

  stockDe(articuloId: string) {
    return this.stock.get(articuloId) ?? 0;
  }

  descontar(articuloId: string, cantidad: number) {
    this.stock.set(articuloId, this.stockDe(articuloId) - cantidad);
  }

  /** Prefijo primero (más relevante), después coincidencia parcial */
  buscar(termino: string, limite = 10): ArticuloLocal[] {
    const t = normalizar(termino);
    if (t.length < 2) return [];

    const prefijos: ArticuloLocal[] = [];
    const parciales: ArticuloLocal[] = [];

    for (const e of this.indice) {
      if (e.texto.startsWith(t)) {
        prefijos.push(e.articulo);
        if (prefijos.length >= limite) break;
      } else if (e.texto.includes(t) && parciales.length < limite) {
        parciales.push(e.articulo);
      }
    }

    return [...prefijos, ...parciales].slice(0, limite);
  }

  get cantidad() {
    return this.porId.size;
  }
}

/** Sin acentos y en minúsculas: "azúcar" encuentra "azucar" */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export const catalogo = new CatalogoCache();

/** Descarga el catálogo de Supabase a la base local. Al abrir caja. */
export async function sincronizarCatalogo(
  supabase: any,
  sucursalId: string,
): Promise<{ articulos: number; ms: number }> {
  const t0 = performance.now();

  const [{ data: articulos }, { data: stock }] = await Promise.all([
    supabase
      .from('articulos')
      .select('id, codigo_barras, codigo_interno, nombre, unidad, costo_unitario, precio_venta_final, activo')
      .eq('activo', true),
    supabase
      .from('stock_sucursal')
      .select('articulo_id, cantidad_disponible')
      .eq('sucursal_id', sucursalId),
  ]);

  const locales = (articulos ?? []).map((a: any) => ({
    id: a.id,
    codigoBarras: a.codigo_barras,
    codigoInterno: a.codigo_interno,
    nombre: a.nombre,
    unidad: a.unidad,
    costoUnitario: Number(a.costo_unitario),
    precioVentaFinal: Number(a.precio_venta_final ?? 0),
    activo: a.activo,
  }));

  const stockLocal = (stock ?? []).map((s: any) => ({
    articuloId: s.articulo_id,
    cantidad: Number(s.cantidad_disponible),
  }));

  await dbLocal.transaction('rw', dbLocal.articulos, dbLocal.stock, async () => {
    await dbLocal.articulos.clear();
    await dbLocal.articulos.bulkPut(locales);
    await dbLocal.stock.clear();
    await dbLocal.stock.bulkPut(stockLocal);
  });

  catalogo.cargar(locales, stockLocal);

  return { articulos: locales.length, ms: Math.round(performance.now() - t0) };
}

/** Carga desde la base local, sin red. Para arrancar sin internet. */
export async function cargarCatalogoLocal() {
  const [articulos, stock] = await Promise.all([
    dbLocal.articulos.toArray(),
    dbLocal.stock.toArray(),
  ]);
  catalogo.cargar(articulos, stock);
  return articulos.length;
}