import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import { FormCliente } from '@/components/clientes/FormCliente';
import { BotonBajaCliente } from '@/components/clientes/BotonBajaCliente';
import { AjusteSaldoCliente } from '@/components/clientes/AjusteSaldoCliente';

interface Ajuste {
  id: string;
  saldo_anterior: number;
  saldo_nuevo: number;
  motivo: string;
  usuario: string;
  created_at: string;
}

export default async function DetalleClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await getSesion();
  if (!['admin', 'gerente', 'supervisor'].includes(sesion.rol)) {
    redirect('/clientes');
  }

  const supabase = await createClient();

  const [{ data: cliente }, { data: ajustes }] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', id).maybeSingle(),
    supabase.rpc('ajustes_de_cliente', { p_cliente_id: id }),
  ]);

  if (!cliente) notFound();

  const saldo = Number(cliente.saldo);
  const limite = Number(cliente.limite_credito);
  const excedido = limite > 0 && saldo > limite;
  const puedeAjustar = ['admin', 'gerente'].includes(sesion.rol);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {cliente.nombre}
        </h1>
        <p
          className={`num text-sm mt-1 ${
            excedido ? 'text-rojo-plomo' : 'text-verde-claro'
          }`}
        >
          Saldo {formatearPrecio(saldo)}
          {limite > 0 && ` · límite ${formatearPrecio(limite)}`}
          {excedido && ' · excedido'}
          {!cliente.activo && ' · dado de baja'}
        </p>

        {puedeAjustar && (
          <div className="mt-3">
            <AjusteSaldoCliente clienteId={cliente.id} saldoActual={saldo} />
          </div>
        )}
      </div>

      <FormCliente cliente={cliente} />

      {(ajustes ?? []).length > 0 && (
        <section className="max-w-lg bg-mostrador rounded-lg ring-1 ring-tiza/60 overflow-hidden">
          <div className="px-4 py-2.5 bg-papel text-verde-claro text-xs uppercase tracking-wide">
            Ajustes de saldo
          </div>
          <ul className="divide-y divide-tiza/40">
            {((ajustes ?? []) as Ajuste[]).map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="num">
                    {formatearPrecio(Number(a.saldo_anterior))} →{' '}
                    <span className="font-medium">
                      {formatearPrecio(Number(a.saldo_nuevo))}
                    </span>
                  </span>
                  <span className="text-xs text-verde-claro whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-verde-claro mt-1">
                  {a.motivo} · {a.usuario}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="max-w-lg pt-2 border-t border-tiza/40">
        <BotonBajaCliente id={cliente.id} activo={cliente.activo} />
      </div>
    </div>
  );
}