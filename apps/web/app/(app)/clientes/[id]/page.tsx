import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';
import { formatearPrecio } from '@pos/shared/constants/empresa';
import { FormCliente } from '@/components/clientes/FormCliente';
import { BotonBajaCliente } from '@/components/clientes/BotonBajaCliente';

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
  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!cliente) notFound();

  const saldo = Number(cliente.saldo);
  const limite = Number(cliente.limite_credito);
  const excedido = limite > 0 && saldo > limite;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {cliente.nombre}
        </h1>
        <p className={`num text-sm mt-1 ${excedido ? 'text-rojo-plomo' : 'text-verde-claro'}`}>
          Saldo {formatearPrecio(saldo)}
          {limite > 0 && ` · límite ${formatearPrecio(limite)}`}
          {excedido && ' · excedido'}
          {!cliente.activo && ' · dado de baja'}
        </p>
      </div>

      <FormCliente cliente={cliente} />

      <div className="max-w-lg pt-2 border-t border-tiza/40">
        <BotonBajaCliente id={cliente.id} activo={cliente.activo} />
      </div>
    </div>
  );
}