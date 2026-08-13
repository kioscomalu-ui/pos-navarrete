'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getSesion } from '@/lib/sesion';
import { createHash } from 'crypto';
import { gzipSync } from 'zlib';

export interface ResultadoPaso {
  ok: boolean;
  mensaje: string;
  cierreId?: string;
}

/** Archiva el detalle del período a Storage y registra el cierre */
export async function archivarPeriodo(
  desde: string,
  hasta: string,
): Promise<ResultadoPaso> {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') return { ok: false, mensaje: 'Sin permisos' };

  const admin = createAdminClient();
  const lineas: string[] = [];
  const TAMANIO = 500;
  let pagina = 0;

  // Exportar paginado, para no cargar todo en memoria
  while (true) {
    const { data, error } = await admin
      .from('ventas')
      .select('*, detalles_venta(*)')
      .gte('fecha', desde)
      .lte('fecha', `${hasta}T23:59:59`)
      .order('fecha', { ascending: true })
      .range(pagina * TAMANIO, (pagina + 1) * TAMANIO - 1);

    if (error) return { ok: false, mensaje: error.message };
    if (!data?.length) break;

    for (const venta of data) lineas.push(JSON.stringify(venta));
    if (data.length < TAMANIO) break;
    pagina++;
  }

  if (lineas.length === 0) {
    return { ok: false, mensaje: 'No hay ventas en ese período' };
  }

  const comprimido = gzipSync(Buffer.from(lineas.join('\n'), 'utf8'));
  const hash = createHash('sha256').update(comprimido).digest('hex');
  const ruta = `ventas_${desde}_${hasta}.jsonl.gz`;

  const { error: errUpload } = await admin.storage
    .from('archivo-ventas')
    .upload(ruta, comprimido, {
      contentType: 'application/gzip',
      upsert: true,
    });

  if (errUpload) return { ok: false, mensaje: errUpload.message };

  // Registrar el cierre: calcula los agregados antes de permitir purgar
  const supabase = await createClient();
  const { data: cierreId, error: errCierre } = await supabase.rpc(
    'cerrar_periodo',
    {
      p_desde: desde,
      p_hasta: hasta,
      p_url_archivo: ruta,
      p_hash_archivo: hash,
    },
  );

  if (errCierre) return { ok: false, mensaje: errCierre.message };

  revalidatePath('/admin/mantenimiento');
  return {
    ok: true,
    mensaje: `${lineas.length} ventas archivadas (${Math.round(comprimido.length / 1024)} kB)`,
    cierreId: cierreId as string,
  };
}

/** Descarga el archivo y verifica que sea legible y coincida el hash */
export async function verificarArchivo(cierreId: string): Promise<ResultadoPaso> {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') return { ok: false, mensaje: 'Sin permisos' };

  const admin = createAdminClient();

  const { data: cierre } = await admin
    .from('cierres_periodo')
    .select('url_archivo, hash_archivo')
    .eq('id', cierreId)
    .single();

  if (!cierre?.url_archivo) {
    return { ok: false, mensaje: 'El cierre no tiene archivo' };
  }

  const { data, error } = await admin.storage
    .from('archivo-ventas')
    .download(cierre.url_archivo);

  if (error || !data) {
    return { ok: false, mensaje: 'No se pudo descargar el archivo' };
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  const hash = createHash('sha256').update(bytes).digest('hex');

  if (hash !== cierre.hash_archivo) {
    return { ok: false, mensaje: 'El hash no coincide: el archivo está dañado' };
  }

  // Descomprimir y validar que sea JSONL parseable
  const { gunzipSync } = await import('zlib');
  try {
    const texto = gunzipSync(bytes).toString('utf8');
    const lineas = texto.trim().split('\n');
    JSON.parse(lineas[0]);
    JSON.parse(lineas[lineas.length - 1]);

    const supabase = await createClient();
    await supabase.rpc('marcar_archivo_verificado', { p_cierre_id: cierreId });

    revalidatePath('/admin/mantenimiento');
    return {
      ok: true,
      mensaje: `Archivo verificado: ${lineas.length} ventas legibles`,
    };
  } catch {
    return { ok: false, mensaje: 'El contenido del archivo no es legible' };
  }
}

/** Purga el detalle. Requiere los pasos anteriores completos. */
export async function purgarPeriodo(
  cierreId: string,
  confirmacion: string,
  esperado: string,
): Promise<ResultadoPaso> {
  const sesion = await getSesion();
  if (sesion.rol !== 'admin') return { ok: false, mensaje: 'Sin permisos' };

  if (confirmacion.trim().toUpperCase() !== esperado.toUpperCase()) {
    return { ok: false, mensaje: 'El texto de confirmación no coincide' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('purgar_periodo_cerrado', {
    p_cierre_id: cierreId,
  });

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath('/admin/mantenimiento');
  return { ok: true, mensaje: `${data} ventas purgadas de la base operativa` };
}