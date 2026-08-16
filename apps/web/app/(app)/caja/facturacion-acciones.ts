'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getSesion } from '@/lib/sesion';
import { ProveedorREST } from '@/lib/facturacion/proveedor-rest';
import {
  tipoQueCorresponde,
  CONDICION_IVA_RECEPTOR,
  TIPO_DOC,
} from '@/lib/facturacion/tipos';

export interface DatosReceptor {
  nombre?: string;
  docTipo: number;
  docNro: string;
  condicionIva: number;
}

export interface ResultadoFacturacion {
  ok: boolean;
  comprobanteId?: string;
  tipo?: string;
  numero?: number;
  puntoVenta?: number;
  cae?: string;
  caeVencimiento?: string;
  qrDatos?: string;
  pendiente?: boolean;   // se encoló para cuando haya conexión
  error?: string;
}

function proveedor() {
  return new ProveedorREST(
    process.env.FACTURACION_URL!,
    process.env.FACTURACION_API_KEY!,
    process.env.FACTURACION_CUIT!,
  );
}

/**
 * Emite una factura para una venta ya cerrada.
 * La venta existe pase lo que pase: esto solo agrega el comprobante.
 */
export async function facturarVenta(
  ventaId: string,
  ventaFecha: string,
  receptor: DatosReceptor,
): Promise<ResultadoFacturacion> {
  const sesion = await getSesion();
  const supabase = await createClient();

  // --- Configuración fiscal ---
  const { data: config } = await supabase
    .from('config_fiscal')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (!config?.facturacion_activa) {
    return { ok: false, error: 'La facturación electrónica no está activada' };
  }

  // --- La venta ---
  const { data: venta } = await supabase
    .from('ventas')
    .select('total, fecha')
    .eq('id', ventaId)
    .eq('fecha', ventaFecha)
    .maybeSingle();

  if (!venta) {
    return {
      ok: false,
      error: 'La venta todavía no se sincronizó. Probá en unos segundos.',
    };
  }

  const { data: detalles } = await supabase
    .from('detalles_venta')
    .select('nombre_snapshot, cantidad, precio_unitario, subtotal')
    .eq('venta_id', ventaId)
    .eq('venta_fecha', ventaFecha);

  const tipo = tipoQueCorresponde(config.condicion_iva, receptor.condicionIva);

  // --- Registrar el comprobante antes de pedir el CAE ---
  // Así queda rastro aunque falle la llamada.
  const admin = createAdminClient();

  const { data: comprobante, error: errIns } = await admin
    .from('comprobantes')
    .insert({
      venta_id: ventaId,
      venta_fecha: ventaFecha,
      tipo,
      estado: 'procesando',
      punto_venta: config.punto_venta_arca,
      cliente_nombre: receptor.nombre,
      cliente_doc_tipo: receptor.docTipo,
      cliente_doc_nro: receptor.docNro,
      cliente_cond_iva: receptor.condicionIva,
      neto: Number(venta.total),
      iva: 0,
      total: Number(venta.total),
      solicitado_por: sesion.usuarioId,
    })
    .select('id')
    .single();

  if (errIns || !comprobante) {
    return { ok: false, error: errIns?.message ?? 'No se pudo registrar' };
  }

  // --- Pedir el CAE ---
  const r = await proveedor().solicitarCAE({
    tipo: tipo as 'factura_a' | 'factura_b' | 'factura_c',
    puntoVenta: config.punto_venta_arca,
    fecha: new Date(venta.fecha),
    neto: Number(venta.total),
    iva: 0,
    total: Number(venta.total),
    receptor,
    items: (detalles ?? []).map((d) => ({
      descripcion: d.nombre_snapshot,
      cantidad: Number(d.cantidad),
      precioUnitario: Number(d.precio_unitario),
      subtotal: Number(d.subtotal),
    })),
  });

  if (!r.ok) {
    await admin
      .from('comprobantes')
      .update({
        estado: r.reintentable ? 'pendiente' : 'rechazado',
        ultimo_error: r.error,
        observaciones_arca: r.observaciones,
        intentos: 1,
      })
      .eq('id', comprobante.id);

    return {
      ok: false,
      comprobanteId: comprobante.id,
      pendiente: r.reintentable,
      error: r.reintentable
        ? 'No se pudo conectar con ARCA. La factura queda pendiente y sale sola cuando vuelva el servicio.'
        : r.error,
    };
  }

  await admin
    .from('comprobantes')
    .update({
      estado: 'autorizado',
      numero: r.numero,
      cae: r.cae,
      cae_vencimiento: r.caeVencimiento,
      qr_datos: r.qrDatos,
      autorizado_at: new Date().toISOString(),
    })
    .eq('id', comprobante.id);

  await admin
    .from('ventas')
    .update({ comprobante_solicitado: true })
    .eq('id', ventaId)
    .eq('fecha', ventaFecha);

  revalidatePath('/admin/facturacion');

  return {
    ok: true,
    comprobanteId: comprobante.id,
    tipo,
    numero: r.numero,
    puntoVenta: config.punto_venta_arca,
    cae: r.cae,
    caeVencimiento: r.caeVencimiento,
    qrDatos: r.qrDatos,
  };
}

/** Reintenta los comprobantes que quedaron pendientes */
export async function reintentarPendientes(): Promise<{
  procesados: number;
  autorizados: number;
}> {
  const sesion = await getSesion();
  if (!['admin', 'gerente'].includes(sesion.rol)) {
    return { procesados: 0, autorizados: 0 };
  }

  const supabase = await createClient();
  const { data: pendientes } = await supabase.rpc('comprobantes_pendientes');

  let autorizados = 0;

  for (const p of (pendientes ?? []).slice(0, 20)) {
    const r = await facturarPendiente(p.id);
    if (r) autorizados++;
  }

  revalidatePath('/admin/facturacion');
  return { procesados: pendientes?.length ?? 0, autorizados };
}

async function facturarPendiente(comprobanteId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: c } = await admin
    .from('comprobantes')
    .select('*')
    .eq('id', comprobanteId)
    .single();

  if (!c) return false;

  const { data: config } = await admin
    .from('config_fiscal')
    .select('*')
    .limit(1)
    .single();

  const { data: detalles } = await admin
    .from('detalles_venta')
    .select('nombre_snapshot, cantidad, precio_unitario, subtotal')
    .eq('venta_id', c.venta_id)
    .eq('venta_fecha', c.venta_fecha);

  const r = await proveedor().solicitarCAE({
    tipo: c.tipo,
    puntoVenta: config.punto_venta_arca,
    fecha: new Date(c.venta_fecha),
    neto: Number(c.neto),
    iva: Number(c.iva),
    total: Number(c.total),
    receptor: {
      nombre: c.cliente_nombre,
      docTipo: c.cliente_doc_tipo,
      docNro: c.cliente_doc_nro,
      condicionIva: c.cliente_cond_iva,
    },
    items: (detalles ?? []).map((d) => ({
      descripcion: d.nombre_snapshot,
      cantidad: Number(d.cantidad),
      precioUnitario: Number(d.precio_unitario),
      subtotal: Number(d.subtotal),
    })),
  });

  await admin
    .from('comprobantes')
    .update(
      r.ok
        ? {
            estado: 'autorizado',
            numero: r.numero,
            cae: r.cae,
            cae_vencimiento: r.caeVencimiento,
            qr_datos: r.qrDatos,
            autorizado_at: new Date().toISOString(),
          }
        : {
            estado: r.reintentable ? 'pendiente' : 'rechazado',
            ultimo_error: r.error,
            intentos: c.intentos + 1,
          },
    )
    .eq('id', comprobanteId);

  return r.ok;
}