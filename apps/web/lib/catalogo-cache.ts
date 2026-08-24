import { dbLocal, type ArticuloLocal } from './db-local';

class CatalogoCache {
  private porCodigoBarras = new Map<string, ArticuloLocal>();
  private porCodigoInterno = new Map<string, ArticuloLocal>();
  private porId = new Map<string, ArticuloLocal>();
  private indice: Array<{ texto: string; articulo: ArticuloLocal }> = [];
  private stock = new Map<string, number>();
  private generico: ArticuloLocal | null = null;

  cargado = false;

  cargar(
    articulos: ArticuloLocal[],
    stock: { articuloId: string; cantidad: number }[],
  ) {
    this.porCodigoBarras.clear();
    this.porCodigoInterno.clear();
    this.porId.clear();
    this.stock.clear();
    this.indice = [];
    this.generico = null;

    for (const a of articulos) {
      if (!a.activo) continue;

      this.porId.set(a.id, a);
      if (a.codigoBarras) this.porCodigoBarras.set(a.codigoBarras, a);
      if (a.codigoInterno) this.porCodigoInterno.set(a.codigoInterno, a);
      if (a.esGenerico) this.generico = a;

      this.indice.push({
        texto: normalizar(
          a.esGenerico
            ? `${a.nombre} venta libre varios otro`
            : `${a.nombre} ${a.codigoBarras ?? ''} ${a.codigoInterno ?? ''}`,
        ),
        articulo: a,
      });
    }

    for (const s of stock) this.stock.set(s.articuloId, s.cantidad);

    this.cargado = true;
  }

  porCodigo(codigo: string): ArticuloLocal | null {
    const c = codigo.trim();
    if (!c) return null;
    return this.porCodigoBarras.get(c) ?? this.porCodigoInterno.get(c) ?? null;
  }

  obtener(id: string): ArticuloLocal | null {
    return this.porId.get(id) ?? null;
  }

  obtenerGenerico(): ArticuloLocal | null {
    return this.generico;
  }

  stockDe(articuloId: string): number {
    return this.stock.get(articuloId) ?? 0;
  }

  descontar(articuloId: string, cantidad: number) {
    this.stock.set(articuloId, this.stockDe(articuloId) - cantidad);
  }

  buscar(termino: string, limite = 10): ArticuloLocal[] {
    const crudo = termino.trim();
    if (crudo.length < 2) return [];

    const exacto = this.porCodigo(crudo);
    if (exacto) return [exacto];

    const t = normalizar(crudo);
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

  get cantidad(): number {
    return this.porId.size;
  }
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const catalogo = new CatalogoCache();

const TANDA = 1000;

export async function sincronizarCatalogo(
  supabase: any,
  sucursalId: string,
): Promise<{ articulos: number; ms: number }> {
  const t0 = performance.now();

  const articulosCrudos: any[] = [];
  for (let desde = 0; ; desde += TANDA) {
    const { data, error } = await supabase
      .from('articulos')
      .select(
        'id, codigo_barras, codigo_interno, nombre, unidad, ' +
          'costo_unitario, precio_venta_final, activo, es_generico, ' +
          'es_servicio_comision, comision_porcentaje',
      )
      .eq('activo', true)
      .order('id')
      .range(desde, desde + TANDA - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    articulosCrudos.push(...data);
    if (data.length < TANDA) break;
  }

  const stockCrudo: any[] = [];
  for (let desde = 0; ; desde += TANDA) {
    const { data, error } = await supabase
      .from('stock_sucursal')
      .select('articulo_id, cantidad_disponible')
      .eq('sucursal_id', sucursalId)
      .order('articulo_id')
      .range(desde, desde + TANDA - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    stockCrudo.push(...data);
    if (data.length < TANDA) break;
  }

  const locales: ArticuloLocal[] = articulosCrudos.map((a) => ({
    id: a.id,
    codigoBarras: a.codigo_barras,
    codigoInterno: a.codigo_interno,
    nombre: a.nombre,
    unidad: a.unidad,
    costoUnitario: Number(a.costo_unitario),
    precioVentaFinal: Number(a.precio_venta_final ?? 0),
    activo: a.activo,
    esGenerico: !!a.es_generico,
    esServicioComision: !!a.es_servicio_comision,
    comisionPorcentaje:
      a.comision_porcentaje != null ? Number(a.comision_porcentaje) : null,
  }));

  const stockLocal = stockCrudo.map((s) => ({
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

export async function cargarCatalogoLocal(): Promise<number> {
  const [articulos, stock] = await Promise.all([
    dbLocal.articulos.toArray(),
    dbLocal.stock.toArray(),
  ]);

  catalogo.cargar(articulos, stock);
  return articulos.length;
}