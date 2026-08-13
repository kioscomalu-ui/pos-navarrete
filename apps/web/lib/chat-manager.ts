import { dbLocal, type CanalLocal, type MensajeLocal } from './db-local';
import { encolar } from './cola-sync';
import { supabase } from './supabase';

export interface ContextoChat {
  usuarioId: string;
  nombreUsuario: string;
  sucursalId: string;
}

/** Descarga los canales del usuario */
export async function sincronizarCanales(): Promise<CanalLocal[]> {
  const { data, error } = await supabase
    .from('canales')
    .select('id, nombre, tipo, solo_lectura, canal_miembros(ultimo_leido_at)')
    .eq('archivado', false)
    .order('tipo');

  if (error) throw error;

  const canales: CanalLocal[] = (data ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    soloLectura: c.solo_lectura,
    ultimoLeidoAt: c.canal_miembros?.[0]?.ultimo_leido_at ?? null,
  }));

  await dbLocal.transaction('rw', dbLocal.canales, async () => {
    await dbLocal.canales.clear();
    await dbLocal.canales.bulkPut(canales);
  });

  return canales;
}

export async function canalesLocales(): Promise<CanalLocal[]> {
  return dbLocal.canales.toArray();
}

/** Mensajes recientes de un canal, desde la base local */
export async function mensajesLocales(
  canalId: string,
  limite = 60,
): Promise<MensajeLocal[]> {
  const todos = await dbLocal.mensajes
    .where('canalId')
    .equals(canalId)
    .reverse()
    .sortBy('createdAt');

  return todos.slice(0, limite).reverse();
}

/** Trae del servidor lo que falta desde el último mensaje que tengo */
export async function sincronizarMensajes(canalId: string): Promise<number> {
  const ultimo = await dbLocal.mensajes
    .where('canalId')
    .equals(canalId)
    .filter((m) => m.estadoLocal === 'enviado')
    .last();

  const desde = ultimo?.createdAt ?? '1970-01-01T00:00:00Z';

  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('canal_id', canalId)
    .gt('created_at', desde)
    .is('eliminado_at', null)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw error;
  if (!data?.length) return 0;

  await dbLocal.mensajes.bulkPut(data.map(desdeRemoto));
  return data.length;
}

export function desdeRemoto(m: any): MensajeLocal {
  return {
    id: m.id,
    canalId: m.canal_id,
    autorId: m.autor_id,
    autorNombre: m.autor_nombre,
    sucursalOrigenId: m.sucursal_origen_id,
    tipo: m.tipo,
    contenido: m.contenido,
    metadata: m.metadata,
    createdAt: m.created_at,
    estadoLocal: 'enviado',
  };
}

/**
 * Envía un mensaje. Aparece en pantalla al instante
 * y sube cuando hay conexión.
 */
export async function enviarMensaje(
  ctx: ContextoChat,
  canalId: string,
  contenido: string,
  tipo: MensajeLocal['tipo'] = 'texto',
  metadata?: Record<string, unknown>,
): Promise<MensajeLocal> {
  const texto = contenido.trim();
  if (!texto) throw new Error('El mensaje está vacío');

  const mensaje: MensajeLocal = {
    id: crypto.randomUUID(),
    canalId,
    autorId: ctx.usuarioId,
    autorNombre: ctx.nombreUsuario,
    sucursalOrigenId: ctx.sucursalId,
    tipo,
    contenido: texto,
    metadata: metadata ?? null,
    createdAt: new Date().toISOString(),
    estadoLocal: 'pendiente',
  };

  await dbLocal.mensajes.put(mensaje);

  await encolar('mensaje', {
    id: mensaje.id,
    canalId: mensaje.canalId,
    autorId: mensaje.autorId,
    autorNombre: mensaje.autorNombre,
    sucursalOrigenId: mensaje.sucursalOrigenId,
    tipo: mensaje.tipo,
    contenido: mensaje.contenido,
    metadata: mensaje.metadata,
    createdAt: mensaje.createdAt,
  });

  return mensaje;
}

/** Pedido de stock: estructurado, no texto suelto */
export async function pedirStock(
  ctx: ContextoChat,
  canalDestino: string,
  articulo: { id: string; nombre: string },
  cantidad: number,
): Promise<MensajeLocal> {
  return enviarMensaje(
    ctx,
    canalDestino,
    `Necesito ${cantidad} × ${articulo.nombre}`,
    'pedido_stock',
    {
      articuloId: articulo.id,
      articuloNombre: articulo.nombre,
      cantidad,
      estado: 'pendiente',
      sucursalSolicitante: ctx.sucursalId,
    },
  );
}

export async function responderPedido(
  mensajeId: string,
  estado: 'confirmado' | 'rechazado',
) {
  const { error } = await supabase.rpc('responder_pedido_stock', {
    p_mensaje_id: mensajeId,
    p_estado: estado,
  });
  if (error) throw error;

  const local = await dbLocal.mensajes.get(mensajeId);
  if (local) {
    await dbLocal.mensajes.update(mensajeId, {
      metadata: { ...(local.metadata ?? {}), estado },
    });
  }
}

/** No leídos por canal, calculado localmente */
export async function noLeidosPorCanal(
  usuarioId: string,
): Promise<Map<string, number>> {
  const canales = await dbLocal.canales.toArray();
  const mapa = new Map<string, number>();

  for (const canal of canales) {
    const corte = canal.ultimoLeidoAt ?? '1970-01-01T00:00:00Z';

    const n = await dbLocal.mensajes
      .where('canalId')
      .equals(canal.id)
      .filter((m) => m.createdAt > corte && m.autorId !== usuarioId)
      .count();

    if (n > 0) mapa.set(canal.id, n);
  }

  return mapa;
}

export async function marcarLeido(canalId: string) {
  const ahora = new Date().toISOString();
  await dbLocal.canales.update(canalId, { ultimoLeidoAt: ahora });

  if (navigator.onLine) {
    await supabase.rpc('marcar_canal_leido', { p_canal_id: canalId });
  }
}