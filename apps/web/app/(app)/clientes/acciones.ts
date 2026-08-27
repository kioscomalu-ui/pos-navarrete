'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase-server';
import { getSesion } from '@/lib/sesion';

function puedeGestionarClientes(rol: string): boolean {
  return ['admin', 'gerente', 'supervisor'].includes(rol);
}

const esquema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  telefono: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  zona: z.string().trim().optional(),
  limiteCredito: z.coerce.number().min(0),
  // Solo se usa al crear, para migrar el saldo de un sistema anterior
  saldoInicial: z.coerce.number().optional(),
});

export type EstadoForm = { error?: string; campo?: string };

export async function guardarCliente(
  _prev: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sesion = await getSesion();
  if (!puedeGestionarClientes(sesion.rol)) {
    return { error: 'No tenés permisos para editar clientes' };
  }

  const parsed = esquema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const primero = parsed.error.issues[0];
    return { error: primero.message, campo: String(primero.path[0]) };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const id = formData.get('id') as string | null;

  const fila = {
    nombre: d.nombre,
    telefono: d.telefono || null,
    direccion: d.direccion || null,
    zona: d.zona || null,
    limite_credito: d.limiteCredito,
  };

  const { error } = id
    ? await supabase.from('clientes').update(fila).eq('id', id)
    : await supabase.from('clientes').insert({
        ...fila,
        saldo: d.saldoInicial || 0,
        activo: true,
      });

  if (error) return { error: error.message };

  revalidatePath('/clientes');
  if (id) revalidatePath(`/clientes/${id}`);
  redirect('/clientes');
}

export async function alternarActivoCliente(id: string, activo: boolean) {
  const sesion = await getSesion();
  if (!puedeGestionarClientes(sesion.rol)) return;

  const supabase = await createClient();
  await supabase.from('clientes').update({ activo }).eq('id', id);

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
}
// ====================================================================
// Ajuste de saldo
//
// El saldo normalmente sale de las ventas a cuenta corriente y de los
// cobros — no es un campo de edición libre. Este ajuste existe para
// los casos legítimos (una deuda anterior al sistema, un error de
// carga inicial) y por eso exige un motivo y queda registrado con el
// usuario que lo hizo.
// ====================================================================

export async function ajustarSaldoCliente(
  clienteId: string,
  saldoNuevo: number,
  motivo: string,
): Promise<EstadoForm> {
  const sesion = await getSesion();
  if (!['admin', 'gerente'].includes(sesion.rol)) {
    return { error: 'No tenés permisos para ajustar saldos' };
  }

  if (!Number.isFinite(saldoNuevo) || saldoNuevo < 0) {
    return { error: 'El saldo tiene que ser un número positivo' };
  }

  if (motivo.trim().length < 5) {
    return { error: 'Indicá el motivo del ajuste' };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc('ajustar_saldo_cliente', {
    p_cliente_id: clienteId,
    p_saldo_nuevo: saldoNuevo,
    p_motivo: motivo.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${clienteId}`);
  return {};
}