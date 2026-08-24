import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { resolverRango } from '@/lib/rangos-fecha';
import { SelectorRango } from '@/components/reportes/SelectorRango';
import { formatearPrecio } from '@pos/shared/constants/empresa';

interface FilaArqueo {
  caja_id: string;
  fecha: string;
  vendedor: string;
  estado: string;
  efectivo_inicial: number;
  total_ventas: number;
  efectivo_final: number;
  diferencia: number;
  notas: string | null;
}

export default async function ReporteArqueos({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string; vendedor?: string }>;
}) {
  const sp = await searchParams;
  const rango = resolverRango(sp.rango, sp.desde, sp.hasta);
  const sesion = await getSesion();
  const supabase = await createClient();

  const { data } = await supabase.rpc('reporte_arqueos', {
    p_desde: rango.desde,
    p_hasta: rango.hasta,
    p_sucursal_id: sesion.rol === 'admin' ? null : sesion.sucursalId,
  });

  const todas = (data ?? []) as FilaArqueo[];

  const vendedores = [...new Set(todas.map((f) => f.vendedor))].sort();

  const vendedorSeleccionado = sp.vendedor ?? '';
  const filas = vendedorSeleccionado
    ? todas.filter((f) => f.vendedor === vendedorSeleccionado)
    : [...todas].sort((a, b) => {
        const porVendedor = a.vendedor.localeCompare(b.vendedor, 'es');
        return porVendedor !== 0 ? porVendedor : b.fecha.localeCompare(a.fecha);
      });

  const conDiferencia = filas.filter((f) => Math.abs(Number(f.diferencia ?? 0)) > 0);
  const sumaDiferencias = filas.reduce((a, f) => a + Number(f.diferencia ?? 0), 0);

  function urlConVendedor(v: string): string {
    const params = new URLSearchParams();
    if (sp.rango) params.set('rango', sp.rango);
    if (sp.desde) params.set('desde', sp.desde);
    if (sp.hasta) params.set('hasta', sp.hasta);
    if (v) params.set('vendedor', v);
    const qs = params.toString();
    return qs ? `/reportes/arqueos?${qs}` : '/reportes/arqueos';
  }

  return (
    <div className="space-y-6">
      <SelectorRango />

      {vendedores.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={urlConVendedor('')}
            className={`px-3 py-1.5 text-xs rounded-full ${
              !vendedorSeleccionado
                ? 'bg-verde-esmalte text-white'
                : 'bg-mostrador ring-1 ring-tiza/60 text-verde-claro'
            }`}
          >
            Todos
          </Link>
          {vendedores.map((v) => (
            <Link
              key={v}
              href={urlConVendedor(v)}
              className={`px-3 py-1.5 text-xs rounded-full ${
                vendedorSeleccionado === v
                  ? 'bg-verde-esmalte text-white'
                  : 'bg-mostrador ring-1 ring-tiza/60 text-verde-claro'
              }`}
            >
              {v}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tarjeta etiqueta="Cierres" valor={String(filas.length)} />
        <Tarjeta etiqueta="Con diferencia" valor={String(conDiferencia.length)} />
        <Tarjeta
          etiqueta="Diferencia acumulada"
          valor={formatearPrecio(sumaDiferencias)}
          alerta={Math.abs(sumaDiferencias) > 0}
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[34rem]">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Fecha</th>
                <th className="text-left font-medium px-4 py-2.5">Vendedor</th>
                <th className="text-right font-medium px-4 py-2.5">Inicial</th>
                <th className="text-right font-medium px-4 py-2.5">Ventas</th>
                <th className="text-right font-medium px-4 py-2.5">Contado</th>
                <th className="text-right font-medium px-4 py-2.5">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filas.map((f) => {
                const dif = Number(f.diferencia ?? 0);
                return (
                  <tr key={f.caja_id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      {new Date(f.fecha + 'T12:00').toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                      {f.estado === 'abierta' && (
                        <span className="ml-2 text-xs text-amber-600">abierta</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {f.vendedor}
                      {f.notas && (
                        <p className="text-xs text-neutral-500 mt-0.5">{f.notas}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {formatearPrecio(Number(f.efectivo_inicial))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                      {f.total_ventas != null
                        ? formatearPrecio(Number(f.total_ventas))
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {f.efectivo_final != null
                        ? formatearPrecio(Number(f.efectivo_final))
                        : '—'}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-medium ${
                        dif === 0
                          ? 'text-neutral-400'
                          : dif > 0
                            ? 'text-blue-700'
                            : 'text-red-700'
                      }`}
                    >
                      {f.diferencia != null
                        ? `${dif > 0 ? '+' : ''}${formatearPrecio(dif)}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filas.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            No hay cierres de caja en este período
          </p>
        )}
      </div>
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  alerta,
}: {
  etiqueta: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded p-4">
      <div className="text-xs text-neutral-500">{etiqueta}</div>
      <div className={`font-mono mt-1 text-lg ${alerta ? 'text-amber-700' : ''}`}>
        {valor}
      </div>
    </div>
  );
}