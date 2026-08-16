import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { getSesion, puedeEditarCatalogo } from '@/lib/sesion';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import { calcularMargen } from '@pos/shared/utils/calcular-precio';
import { BotonPedirStock } from '@/components/chat/BotonPedirStock';

const SELECT_ARTICULO = `
  id, codigo_barras, codigo_interno, nombre, unidad, activo,
  costo_unitario, precio_venta_final, stock_minimo,
  categorias_articulos(nombre),
  stock_sucursal(cantidad_disponible, sucursal_id)
`;

const POR_PAGINA = 50;

interface StockFila {
  cantidad_disponible: number;
  sucursal_id: string;
}

/**
 * Escapa los caracteres que rompen el filtro .or() de PostgREST.
 * Sin esto, un término con coma o paréntesis genera una consulta inválida.
 */
function limpiarTermino(q: string): string {
  return q.trim().replace(/[,()\\]/g, ' ');
}

export default async function ArticulosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactivos?: string; pagina?: string }>;
}) {
  const { q, inactivos, pagina: paginaParam } = await searchParams;
  const verInactivos = inactivos === '1';
  const termino = q ? limpiarTermino(q) : '';

  const pagina = Math.max(1, Number(paginaParam) || 1);
  const desde = (pagina - 1) * POR_PAGINA;
  const hasta = desde + POR_PAGINA - 1;

  const sesion = await getSesion();
  const supabase = await createClient();

  // --- Búsqueda: nombre, código de barras o código interno ---
  let query = supabase
    .from('articulos')
    .select(SELECT_ARTICULO, { count: 'exact' })
    .order('nombre')
    .range(desde, hasta);

  if (!verInactivos) query = query.eq('activo', true);

  if (termino) {
    query = query.or(
      [
        `nombre.ilike.%${termino}%`,
        `codigo_barras.ilike.%${termino}%`,
        `codigo_interno.ilike.%${termino}%`,
      ].join(','),
    );
  }

  const { data, error, count } = await query;

  let articulos = data;
  let total = count ?? 0;
  let porCodigoProveedor = false;

  // --- Si no encontró nada en la página 1, probar por el código
  //     que usa el proveedor. Sirve cuando llega la factura con
  //     su nomenclatura. ---
  if (termino && pagina === 1 && (!articulos || articulos.length === 0)) {
    const { data: coincidencias } = await supabase.rpc(
      'buscar_por_codigo_proveedor',
      { p_texto: termino },
    );

    if (coincidencias && coincidencias.length > 0) {
      const ids = coincidencias.map((r: { articulo_id: string }) => r.articulo_id);

      const { data: encontrados, count: countProv } = await supabase
        .from('articulos')
        .select(SELECT_ARTICULO, { count: 'exact' })
        .in('id', ids)
        .order('nombre');

      if (encontrados && encontrados.length > 0) {
        articulos = encontrados;
        total = countProv ?? encontrados.length;
        porCodigoProveedor = true;
      }
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const ctxChat = {
    usuarioId: sesion.usuarioId,
    nombreUsuario: sesion.nombre,
    sucursalId: sesion.sucursalId,
  };
  const puedeEditar = puedeEditarCatalogo(sesion.rol);

  function urlPagina(p: number): string {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (verInactivos) params.set('inactivos', '1');
    if (p > 1) params.set('pagina', String(p));
    const qs = params.toString();
    return qs ? `/articulos?${qs}` : '/articulos';
  }

  return (
    <div className="space-y-5">
      {/* --- Encabezado --- */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Artículos</h1>
          <p className="text-sm text-verde-claro mt-0.5">
            <span className="num">{total}</span> artículos
            {verInactivos && ' · incluyendo dados de baja'}
            {totalPaginas > 1 && (
              <>
                {' · página '}
                <span className="num">{pagina}</span> de{' '}
                <span className="num">{totalPaginas}</span>
              </>
            )}
          </p>
        </div>

        {puedeEditar && (
          <div className="flex gap-2 shrink-0">
            <Link
              href="/articulos/ajustar"
              className="px-3 py-2 text-sm rounded-lg ring-1 ring-tiza/60 bg-mostrador
                         hover:ring-verde-claro"
            >
              Ajustar precios
            </Link>
            <Link
              href="/articulos/importar"
              className="px-3 py-2 text-sm rounded-lg ring-1 ring-tiza/60 bg-mostrador
                         hover:ring-verde-claro"
            >
              Importar CSV
            </Link>
            <Link
              href="/articulos/nuevo"
              className="px-3 py-2 text-sm rounded-lg bg-verde-esmalte text-white
                         hover:bg-verde-hondo"
            >
              Nuevo artículo
            </Link>
          </div>
        )}
      </div>

      {/* --- Búsqueda --- */}
      <form className="flex gap-2">
        {verInactivos && <input type="hidden" name="inactivos" value="1" />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o código…"
          className="input flex-1"
        />
        <button className="px-4 py-2 text-sm rounded-lg ring-1 ring-tiza/60 bg-mostrador hover:ring-verde-claro">
          Buscar
        </button>
        {q && (
          <Link
            href={verInactivos ? '/articulos?inactivos=1' : '/articulos'}
            className="px-4 py-2 text-sm text-verde-claro hover:text-verde-esmalte"
          >
            Limpiar
          </Link>
        )}
      </form>

      {porCodigoProveedor && (
        <p className="text-xs text-verde-claro bg-papel rounded px-3 py-2">
          Encontrado por el código que usa el proveedor
        </p>
      )}

      {error && (
        <p className="text-sm text-rojo-plomo font-mono">{error.message}</p>
      )}

      {/* --- Tabla --- */}
      <div className="bg-mostrador rounded-lg ring-1 ring-tiza/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[44rem]">
            <thead className="bg-papel text-verde-claro text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Artículo</th>
                <th className="text-left font-medium px-4 py-2.5">Código</th>
                <th className="text-right font-medium px-4 py-2.5">Costo</th>
                <th className="text-right font-medium px-4 py-2.5">Precio</th>
                <th className="text-right font-medium px-4 py-2.5">Margen</th>
                <th className="text-right font-medium px-4 py-2.5">Stock</th>
                <th className="w-16 px-4 py-2.5"></th>
              </tr>
            </thead>

            <tbody>
              {articulos?.map((a, i) => {
                const costo = Number(a.costo_unitario);
                const precio = Number(a.precio_venta_final ?? 0);
                const margen = calcularMargen(costo, precio);

                const stock = (a.stock_sucursal as unknown as StockFila[])?.find(
                  (s) => s.sucursal_id === sesion.sucursalId,
                );
                const disponible = Number(stock?.cantidad_disponible ?? 0);
                const bajoMinimo = disponible < Number(a.stock_minimo);

                return (
                  <tr
                    key={a.id}
                    className={`${
                      i % 2 === 0 ? 'renglon-impar' : 'renglon-par'
                    } ${!a.activo ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/articulos/${a.id}`}
                        className="hover:underline"
                      >
                        {a.nombre}
                      </Link>
                      {a.unidad !== 'unidad' && (
                        <span className="ml-2 text-xs text-verde-claro">
                          por {a.unidad}
                        </span>
                      )}
                      {!a.activo && (
                        <span className="ml-2 text-xs text-verde-claro">
                          dado de baja
                        </span>
                      )}
                    </td>

                    <td className="num px-4 py-2.5 text-xs text-verde-claro">
                      {a.codigo_barras ?? a.codigo_interno ?? '—'}
                    </td>

                    <td className="num px-4 py-2.5 text-right text-verde-claro">
                      {formatearPrecio(costo)}
                    </td>

                    <td className="num px-4 py-2.5 text-right font-medium">
                      {formatearPrecio(precio)}
                    </td>

                    <td
                      className={`num px-4 py-2.5 text-right ${
                        margen.porcentaje < 10
                          ? 'text-rojo-plomo'
                          : 'text-verde-claro'
                      }`}
                    >
                      {margen.porcentaje}%
                    </td>

                    <td
                      className={`num px-4 py-2.5 text-right ${
                        bajoMinimo ? 'text-ambar-dial font-medium' : ''
                      }`}
                    >
                      {a.unidad === 'unidad'
                        ? disponible
                        : disponible.toFixed(2)}
                      <span className="text-verde-claro/60 ml-1 text-xs">
                        {a.unidad === 'unidad' ? 'un' : a.unidad}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <BotonPedirStock
                        articulo={{ id: a.id, nombre: a.nombre }}
                        ctx={ctxChat}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {articulos?.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-verde-claro/70">
            {q
              ? `No se encontró nada con "${q}", ni por nombre ni por código`
              : 'Todavía no hay artículos cargados'}
          </p>
        )}
      </div>

      {/* --- Paginación --- */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={urlPagina(pagina - 1)}
            aria-disabled={pagina <= 1}
            className={`px-3 py-2 text-sm rounded-lg ring-1 ring-tiza/60 bg-mostrador ${
              pagina <= 1
                ? 'pointer-events-none opacity-30'
                : 'hover:ring-verde-claro'
            }`}
          >
            ← Anterior
          </Link>

          <span className="num text-sm text-verde-claro px-2">
            {pagina} / {totalPaginas}
          </span>

          <Link
            href={urlPagina(pagina + 1)}
            aria-disabled={pagina >= totalPaginas}
            className={`px-3 py-2 text-sm rounded-lg ring-1 ring-tiza/60 bg-mostrador ${
              pagina >= totalPaginas
                ? 'pointer-events-none opacity-30'
                : 'hover:ring-verde-claro'
            }`}
          >
            Siguiente →
          </Link>
        </div>
      )}

      {/* --- Ver dados de baja --- */}
      {puedeEditar && (
        <div className="text-center">
          <Link
            href={
              verInactivos
                ? `/articulos${q ? `?q=${encodeURIComponent(q)}` : ''}`
                : `/articulos?inactivos=1${q ? `&q=${encodeURIComponent(q)}` : ''}`
            }
            className="text-xs text-verde-claro hover:text-verde-esmalte"
          >
            {verInactivos
              ? 'Ocultar artículos dados de baja'
              : 'Ver también los dados de baja'}
          </Link>
        </div>
      )}
    </div>
  );
}