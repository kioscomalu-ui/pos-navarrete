import { dbLocal, type CajaLocal } from './db-local';
import { encolar } from './cola-sync';

export interface TotalesDia {
  cantidadVentas: number;
  total: number;
  /** Solo lo cobrado en efectivo por ventas, sin el fondo inicial */
  efectivo: number;
  /** efectivoInicial de la caja + `efectivo`: lo que debería haber en el cajón */
  efectivoEsperado: number;
  billetera: number;
  posnet: number;
  ctaCte: number;
}

export interface DeclaracionCierre {
  efectivoFinal: number;
  billeteraFinal: number;
  posnetFinal: number;
  notas: string;
}

// ====================================================================
// Apertura
// ====================================================================

export async function abrirCaja(
  vendedorId: string,
  sucursalId: string,
  efectivoInicial: number,
): Promise<CajaLocal> {
  const fecha = new Date().toISOString().slice(0, 10);

  const existente = await dbLocal.cajas
    .where('[vendedorId+fecha]')
    .equals([vendedorId, fecha])
    .first();

  if (existente && existente.estado === 'abierta') return existente;

  const caja: CajaLocal = {
    id: crypto.randomUUID(),
    vendedorId,
    sucursalId,
    fecha,
    estado: 'abierta',
    efectivoInicial,
    efectivoFinal: null,
    billeteraFinal: null,
    posnetFinal: null,
    totalVentas: null,
    totalEfectivo: null,
    totalBilletera: null,
    totalPosnet: null,
    diferencia: null,
    notas: null,
    abiertaEn: new Date().toISOString(),
    closedAt: null,
    syncedAt: null,
  };

  await dbLocal.cajas.put(caja);
  await encolar('caja', caja);

  return caja;
}

/** La caja abierta hoy para este vendedor, o null si no abrió ninguna */
export async function cajaAbierta(vendedorId: string): Promise<CajaLocal | null> {
  const fecha = new Date().toISOString().slice(0, 10);

  const caja = await dbLocal.cajas
    .where('[vendedorId+fecha]')
    .equals([vendedorId, fecha])
    .first();

  return caja && caja.estado === 'abierta' ? caja : null;
}

// ====================================================================
// Totales del día
// ====================================================================

/**
 * Suma las ventas del día por método de pago, a partir del desglose
 * guardado en cada venta (`pagos`). Una venta simple tiene un solo
 * elemento en ese array; una venta combinada, varios — cada uno se
 * cuenta en el método que corresponde, no todo bajo un único total.
 *
 * `efectivoEsperado` ya incluye el fondo inicial: es directamente lo
 * que debería contarse en el cajón al cierre, sin que la pantalla
 * tenga que sumarlo aparte.
 */
export async function totalesDelDia(caja: CajaLocal): Promise<TotalesDia> {
  const ventas = await dbLocal.ventas
    .where('fecha')
    .between(`${caja.fecha}T00:00:00`, `${caja.fecha}T23:59:59`)
    .filter((v) => v.vendedorId === caja.vendedorId)
    .toArray();

  let total = 0;
  let efectivo = 0;
  let billetera = 0;
  let posnet = 0;
  let ctaCte = 0;

  for (const v of ventas) {
    total += v.total;

    for (const p of v.pagos ?? []) {
      if (p.metodo === 'efectivo') efectivo += p.monto;
      if (p.metodo === 'billetera') billetera += p.monto;
      if (p.metodo === 'posnet') posnet += p.monto;
      if (p.metodo === 'cuenta_corriente') ctaCte += p.monto;
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return {
    cantidadVentas: ventas.length,
    total: r2(total),
    efectivo: r2(efectivo),
    efectivoEsperado: r2(caja.efectivoInicial + efectivo),
    billetera: r2(billetera),
    posnet: r2(posnet),
    ctaCte: r2(ctaCte),
  };
}

// ====================================================================
// Cierre
// ====================================================================

export async function cerrarCaja(
  caja: CajaLocal,
  datos: DeclaracionCierre,
): Promise<CajaLocal> {
  const totales = await totalesDelDia(caja);

  // La diferencia se mide contra el efectivo: es el único medio donde
  // puede haber un error humano de conteo. Tarjeta y billetera quedan
  // registrados por su propio medio de pago, no dependen del cajón.
  const diferencia =
    Math.round((datos.efectivoFinal - totales.efectivoEsperado) * 100) / 100;

  const actualizada: CajaLocal = {
    ...caja,
    estado: 'cerrada',
    efectivoFinal: datos.efectivoFinal,
    billeteraFinal: datos.billeteraFinal,
    posnetFinal: datos.posnetFinal,
    totalVentas: totales.total,
    totalEfectivo: totales.efectivo,
    totalBilletera: totales.billetera,
    totalPosnet: totales.posnet,
    diferencia,
    notas: datos.notas || null,
    closedAt: new Date().toISOString(),
  };

  await dbLocal.cajas.put(actualizada);
  await encolar('caja', actualizada);

  return actualizada;
}