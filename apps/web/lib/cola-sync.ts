import { dbLocal, type TareaSync } from './db-local';
import { supabase } from './supabase';

/** Evita que dos ciclos de procesamiento corran a la vez */
let procesando = false;

/** Intentos antes de pasar a una espera larga */
const MAX_INTENTOS = 10;

/** Tareas por ciclo */
const LOTE = 50;

// ====================================================================
// Tipos del payload
// ====================================================================

interface PayloadVenta {
  id: string;
  fecha: string;
  numeroFactura: string;
  sucursalId: string;
  vendedorId: string;
  clienteId: string | null;
  clienteNombre: string | null;
  subtotal: number;
  descuentoTotal: number;
  total: number;
  recibido: number | null;
  vuelto: number | null;
  metodoPago: string;
  remitoNumero: string | null;
  items: Array<{
    articuloId: string;
    nombre: string;
    unidad: string;
    cantidad: number;
    precioUnitario: number;
    descuentoPorcentaje: number;
    subtotal: number;
    costoUnitarioSnapshot: number;
  }>;
}

interface PayloadMensaje {
  id: string;
  canalId: string;
  autorId: string;
  autorNombre: string;
  sucursalOrigenId: string | null;
  tipo: string;
  contenido: string;
  metadata: unknown;
  createdAt: string;
}

// ====================================================================
// Cola
// ====================================================================

export async function encolar(tipo: TareaSync['tipo'], payload: unknown) {
  await dbLocal.cola.put({
    id: crypto.randomUUID(),
    tipo,
    payload,
    intentos: 0,
    proximoIntento: Date.now(),
    ultimoError: null,
    creadoEn: Date.now(),
  });

  // Intento inmediato sin bloquear a quien llamó
  queueMicrotask(() => {
    void procesar();
  });
}

export async function procesar(): Promise<{ enviadas: number; fallidas: number }> {
  if (procesando) return { enviadas: 0, fallidas: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { enviadas: 0, fallidas: 0 };
  }

  procesando = true;
  let enviadas = 0;
  let fallidas = 0;

  try {
    const pendientes = await dbLocal.cola
      .where('proximoIntento')
      .belowOrEqual(Date.now())
      .limit(LOTE)
      .toArray();

    for (const tarea of pendientes) {
      try {
        await enviar(tarea);
        await dbLocal.cola.delete(tarea.id);
        enviadas++;
      } catch (error) {
        fallidas++;
        const intentos = tarea.intentos + 1;

        // Backoff exponencial: 2s, 4s, 8s… con techo de 5 minutos.
        // Después de MAX_INTENTOS, una hora: algo está mal de fondo.
        const espera =
          intentos >= MAX_INTENTOS
            ? 3_600_000
            : Math.min(2 ** intentos * 1000, 300_000);

        await dbLocal.cola.put({
          ...tarea,
          intentos,
          proximoIntento: Date.now() + espera,
          ultimoError: error instanceof Error ? error.message : String(error),
        });

        console.error(`[sync] ${tarea.tipo} falló (intento ${intentos}):`, error);
      }
    }
  } finally {
    procesando = false;
  }

  return { enviadas, fallidas };
}

// ====================================================================
// Envío por tipo
// ====================================================================

async function enviar(tarea: TareaSync) {
  switch (tarea.tipo) {
    // ----------------------------------------------------------------
    case 'venta': {
      const venta = tarea.payload as PayloadVenta;

      const { error } = await supabase.rpc('registrar_venta_completa', {
        p_venta: {
          id: venta.id,
          fecha: venta.fecha,
          numeroFactura: venta.numeroFactura,
          sucursalId: venta.sucursalId,
          vendedorId: venta.vendedorId,
          clienteId: venta.clienteId,
          clienteNombre: venta.clienteNombre,
          subtotal: venta.subtotal,
          descuentoTotal: venta.descuentoTotal,
          total: venta.total,
          recibido: venta.recibido,
          vuelto: venta.vuelto,
          estado: 'completada',
          metodoPago: venta.metodoPago,
          remitoNumero: venta.remitoNumero,
        },
        p_detalles: venta.items.map((i) => ({
          articuloId: i.articuloId,
          nombre: i.nombre,
          unidad: i.unidad,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          descuentoPorcentaje: i.descuentoPorcentaje,
          subtotal: i.subtotal,
          costoUnitarioSnapshot: i.costoUnitarioSnapshot,
        })),
      });

      if (error) throw error;

      await dbLocal.ventas.update(venta.id, {
        syncedAt: new Date().toISOString(),
      });
      break;
    }

    // ----------------------------------------------------------------
    case 'caja': {
      const caja = tarea.payload as { id: string };

      const { error } = await supabase.rpc('registrar_caja', { p_caja: caja });
      if (error) throw error;

      await dbLocal.cajas.update(caja.id, {
        syncedAt: new Date().toISOString(),
      });
      break;
    }

    // ----------------------------------------------------------------
    case 'cobranza': {
      const recibo = tarea.payload as { id: string };

      const { error } = await supabase.rpc('registrar_cobranza', {
        p_recibo: recibo,
      });
      if (error) throw error;

      await dbLocal.recibos.update(recibo.id, {
        syncedAt: new Date().toISOString(),
      });
      break;
    }

    // ----------------------------------------------------------------
    case 'mensaje': {
      const mensaje = tarea.payload as PayloadMensaje;

      const { error } = await supabase.from('mensajes').insert({
        id: mensaje.id,
        canal_id: mensaje.canalId,
        autor_id: mensaje.autorId,
        autor_nombre: mensaje.autorNombre,
        sucursal_origen_id: mensaje.sucursalOrigenId,
        tipo: mensaje.tipo,
        contenido: mensaje.contenido,
        metadata: mensaje.metadata,
        created_at: mensaje.createdAt,
      });

      // 23505 = clave duplicada: ya había subido en un intento anterior
      if (error && error.code !== '23505') throw error;

      await dbLocal.mensajes.update(mensaje.id, { estadoLocal: 'enviado' });
      break;
    }

    // ----------------------------------------------------------------
    default:
      throw new Error(`Tipo de tarea no soportado: ${tarea.tipo}`);
  }
}

// ====================================================================
// Utilidades
// ====================================================================

/** Cantidad de tareas esperando subir */
export async function pendientes(): Promise<number> {
  return dbLocal.cola.count();
}

/** Tareas que vienen fallando, para diagnóstico */
export async function tareasConProblemas(): Promise<TareaSync[]> {
  return dbLocal.cola.filter((t) => t.intentos >= 3).toArray();
}

/** Resetea los contadores y fuerza el envío de todo lo encolado */
export async function reintentarTodo(): Promise<void> {
  const todas = await dbLocal.cola.toArray();
  await dbLocal.cola.bulkPut(
    todas.map((t) => ({
      ...t,
      proximoIntento: Date.now(),
      intentos: 0,
      ultimoError: null,
    })),
  );
  await procesar();
}

/**
 * Arranca el sincronizador en segundo plano.
 * Devuelve la función para detenerlo.
 */
export function iniciarSync(intervaloMs = 30_000): () => void {
  if (typeof window === 'undefined') return () => {};

  const alVolverConexion = () => {
    void procesar();
  };

  window.addEventListener('online', alVolverConexion);

  const intervalo = setInterval(() => {
    void procesar();
  }, intervaloMs);

  // Primer intento al montar
  void procesar();

  return () => {
    window.removeEventListener('online', alVolverConexion);
    clearInterval(intervalo);
  };
}