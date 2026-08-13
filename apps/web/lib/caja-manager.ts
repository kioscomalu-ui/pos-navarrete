import Decimal from 'decimal.js';
import { dbLocal, type CajaLocal, type VentaLocal } from './db-local';
import { encolar } from './cola-sync';

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Caja abierta del vendedor para el día de hoy, si existe */
export async function cajaAbierta(vendedorId: string): Promise<CajaLocal | null> {
  const cajas = await dbLocal.cajas
    .where('fecha')
    .equals(hoy())
    .filter((c) => c.vendedorId === vendedorId && c.estado === 'abierta')
    .toArray();

  return cajas[0] ?? null;
}

export async function abrirCaja(
  vendedorId: string,
  sucursalId: string,
  efectivoInicial: number,
): Promise<CajaLocal> {
  const existente = await cajaAbierta(vendedorId);
  if (existente) return existente;

  const caja: CajaLocal = {
    id: crypto.randomUUID(),
    vendedorId,
    sucursalId,
    fecha: hoy(),
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

export interface TotalesDia {
  cantidadVentas: number;
  total: number;
  efectivo: number;
  billetera: number;
  posnet: number;
  efectivoEsperado: number;      // inicial + ventas en efectivo
}

/**
 * Calcula los totales del día desde las ventas locales.
 * Funciona sin conexión: los datos ya están en el dispositivo.
 */
export async function totalesDelDia(caja: CajaLocal): Promise<TotalesDia> {
  const desde = `${caja.fecha}T00:00:00`;
  const hasta = `${caja.fecha}T23:59:59`;

  const ventas = await dbLocal.ventas
    .where('fecha')
    .between(desde, hasta, true, true)
    .filter((v) => v.vendedorId === caja.vendedorId)
    .toArray();

  const sumar = (filtro: (v: VentaLocal) => boolean) =>
    ventas
      .filter(filtro)
      .reduce((acc, v) => acc.plus(v.total), new Decimal(0))
      .toDecimalPlaces(2)
      .toNumber();

  const efectivo = sumar((v) => v.metodoPago === 'efectivo');

  return {
    cantidadVentas: ventas.length,
    total: sumar(() => true),
    efectivo,
    billetera: sumar((v) => v.metodoPago === 'billetera'),
    posnet: sumar((v) => v.metodoPago === 'posnet'),
    efectivoEsperado: new Decimal(caja.efectivoInicial)
      .plus(efectivo)
      .toDecimalPlaces(2)
      .toNumber(),
  };
}

export interface DeclaracionCierre {
  efectivoFinal: number;
  billeteraFinal: number;
  posnetFinal: number;
  notas: string;
}

export async function cerrarCaja(
  caja: CajaLocal,
  declaracion: DeclaracionCierre,
): Promise<CajaLocal> {
  const totales = await totalesDelDia(caja);

  const diferencia = new Decimal(declaracion.efectivoFinal)
    .minus(totales.efectivoEsperado)
    .toDecimalPlaces(2)
    .toNumber();

  const cerrada: CajaLocal = {
    ...caja,
    estado: 'cerrada',
    efectivoFinal: declaracion.efectivoFinal,
    billeteraFinal: declaracion.billeteraFinal,
    posnetFinal: declaracion.posnetFinal,
    totalVentas: totales.total,
    totalEfectivo: totales.efectivo,
    totalBilletera: totales.billetera,
    totalPosnet: totales.posnet,
    diferencia,
    notas: declaracion.notas || null,
    closedAt: new Date().toISOString(),
  };

  await dbLocal.cajas.put(cerrada);
  await encolar('caja', cerrada);
  return cerrada;
}