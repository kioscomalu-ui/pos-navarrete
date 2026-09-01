export interface RangoFechas {
  desde: string;   // YYYY-MM-DD
  hasta: string;
}

const ZONA = 'America/Argentina/Buenos_Aires';

/**
 * El "ahora" con los componentes de fecha en hora argentina.
 *
 * No alcanza con getFullYear()/getDate(): resolverRango se ejecuta en
 * el servidor de Vercel, que corre en UTC, así que a partir de las
 * 21:00 hora argentina devolvería la fecha de mañana. Y la variable
 * de entorno TZ está reservada en Vercel, no se puede configurar.
 *
 * Se arma a mediodía para que restar días nunca cruce la medianoche
 * por un ajuste de horario.
 */
function hoyLocal(): Date {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const buscar = (t: string) => Number(partes.find((p) => p.type === t)?.value);

  return new Date(buscar('year'), buscar('month') - 1, buscar('day'), 12);
}

/** Formatea una fecha ya construida en componentes locales. */
function isoDeLocal(d: Date): string {
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export const RANGOS = {
  hoy: (): RangoFechas => {
    const h = isoDeLocal(hoyLocal());
    return { desde: h, hasta: h };
  },
  ayer: (): RangoFechas => {
    const d = hoyLocal();
    d.setDate(d.getDate() - 1);
    const a = isoDeLocal(d);
    return { desde: a, hasta: a };
  },
  semana: (): RangoFechas => {
    const hasta = hoyLocal();
    const desde = hoyLocal();
    desde.setDate(desde.getDate() - 6);
    return { desde: isoDeLocal(desde), hasta: isoDeLocal(hasta) };
  },
  mes: (): RangoFechas => {
    const hoy = hoyLocal();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12);
    return { desde: isoDeLocal(primero), hasta: isoDeLocal(hoy) };
  },
  mesAnterior: (): RangoFechas => {
    const hoy = hoyLocal();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1, 12);
    const ultimo = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 12);
    return { desde: isoDeLocal(primero), hasta: isoDeLocal(ultimo) };
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