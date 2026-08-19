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