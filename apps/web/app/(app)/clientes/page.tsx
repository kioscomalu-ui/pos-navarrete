import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { formatearPrecio } from '@pos/shared/constants/empresa';

export default async function ClientesPage() {
  const sesion = await getSesion();
  const supabase = await createClient();

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, zona, saldo, limite_credito, activo')
    .eq('activo', true)
    .order('nombre');

  const conSaldo = (clientes ?? []).filter((c) => Number(c.saldo) > 0);
  const total = conSaldo.reduce((a, c) => a + Number(c.saldo), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-neutral-500">
            {conSaldo.length} con saldo · {formatearPrecio(total)} por cobrar
          </p>
        </div>
        <Link
          href="/clientes/nuevo"
          className="px-3 py-2 text-sm bg-neutral-900 text-white rounded"
        >
          Nuevo cliente
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Cliente</th>
              <th className="text-left font-medium px-4 py-2.5">Zona</th>
              <th className="text-left font-medium px-4 py-2.5">Teléfono</th>
              <th className="text-right font-medium px-4 py-2.5">Límite</th>
              <th className="text-right font-medium px-4 py-2.5">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(clientes ?? []).map((c) => {
              const saldo = Number(c.saldo);
              const limite = Number(c.limite_credito);
              const excedido = limite > 0 && saldo > limite;

              return (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/clientes/${c.id}`} className="hover:underline">
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">{c.zona ?? '—'}</td>
                  <td className="px-4 py-2.5 text-neutral-500 font-mono text-xs">
                    {c.telefono ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                    {limite > 0 ? formatearPrecio(limite) : '—'}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-medium ${
                      excedido ? 'text-red-600' : ''
                    }`}
                  >
                    {formatearPrecio(saldo)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}