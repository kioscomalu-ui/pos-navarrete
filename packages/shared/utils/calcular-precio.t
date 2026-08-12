import Decimal from 'decimal.js';
import type { MargenTipo, ReglaRedondeo } from '../types';

export interface ParamsPrecio {
  costoUnitario: number;
  margenTipo: MargenTipo;
  margenValor: number;
  reglaRedondeo?: ReglaRedondeo;
}

export interface ResultadoPrecio {
  precioBase: number;
  redondeoAplicado: number;
  precioFinal: number;
}

export function calcularPrecio(p: ParamsPrecio): ResultadoPrecio {
  const costo = new Decimal(p.costoUnitario);
  const margen = new Decimal(p.margenValor);

  const base =
    p.margenTipo === 'porcentaje'
      ? costo.times(new Decimal(1).plus(margen.div(100)))
      : costo.plus(margen);

  const final = aplicarRedondeo(base, p.reglaRedondeo ?? 'al_peso');

  return {
    precioBase: base.toDecimalPlaces(2).toNumber(),
    redondeoAplicado: final.minus(base).toDecimalPlaces(2).toNumber(),
    precioFinal: final.toDecimalPlaces(2).toNumber(),
  };
}

function aplicarRedondeo(precio: Decimal, regla: ReglaRedondeo): Decimal {
  switch (regla) {
    case 'sin_redondeo':
      return precio.toDecimalPlaces(2);
    case 'al_peso':
      return precio.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    case 'al_cincuenta':
      return precio.times(2).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).div(2);
    case 'a_la_decena':
      return precio.div(10).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(10);
  }
}

/** Margen real entre costo y precio de venta */
export function calcularMargen(costo: number, precio: number) {
  const c = new Decimal(costo);
  const p = new Decimal(precio);
  const absoluto = p.minus(c);

  return {
    absoluto: absoluto.toDecimalPlaces(2).toNumber(),
    porcentaje: c.isZero()
      ? 0
      : absoluto.div(c).times(100).toDecimalPlaces(2).toNumber(),
  };
}

/** Valida antes de guardar: evita cargar un artículo que se vende a pérdida */
export function validarPrecio(costo: number, precio: number, margenMinimo = 5) {
  if (precio <= costo) {
    return { valido: false, razon: 'El precio no puede ser menor o igual al costo' };
  }
  const { porcentaje } = calcularMargen(costo, precio);
  if (porcentaje < margenMinimo) {
    return { valido: false, razon: `Margen bajo: ${porcentaje}% (mínimo ${margenMinimo}%)` };
  }
  return { valido: true as const };
}