export interface RangoFechas {
  desde: string;   // YYYY-MM-DD
  hasta: string;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const RANGOS = {
  hoy: (): RangoFechas => {
    const h = iso(new Date());
    return { desde: h, hasta: h };
  },

  ayer: (): RangoFechas => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return { desde: iso(d), hasta: iso(d) };
  },

  semana: (): RangoFechas => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return { desde: iso(d), hasta: iso(new Date()) };
  },

  mes: (): RangoFechas => {
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: iso(primero), hasta: iso(hoy) };
  },

  mesAnterior: (): RangoFechas => {
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const ultimo = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    return { desde: iso(primero), hasta: iso(ultimo) };
  },
} as const;

export type NombreRango = keyof typeof RANGOS;

export const ETIQUETAS_RANGO: Record<NombreRango, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  semana: 'Últimos 7 días',
  mes: 'Este mes',
  mesAnterior: 'Mes anterior',
};

export function resolverRango(
  nombre: string | undefined,
  desde?: string,
  hasta?: string,
): RangoFechas {
  if (desde && hasta) return { desde, hasta };
  const r = (nombre ?? 'mes') as NombreRango;
  return (RANGOS[r] ?? RANGOS.mes)();
}