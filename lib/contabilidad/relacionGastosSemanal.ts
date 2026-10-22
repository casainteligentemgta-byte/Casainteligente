/**
 * Relación de gastos semanal de una obra administrada por Dimaquinas.
 * Pura: recibe los datos ya leídos. El porcentaje de administración puede cambiar; cada
 * semana usa el porcentaje vigente en su fecha (historial), no el actual.
 */

export type TramoPorcentaje = { porcentaje: number; vigente_desde: string };

/** Porcentaje vigente en una fecha (YYYY-MM-DD). Historial sin tramos → null. */
export function porcentajeVigente(tramos: TramoPorcentaje[], fecha: string): number | null {
  const ordenados = [...tramos].sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : -1));
  const t = ordenados.find((x) => x.vigente_desde <= fecha);
  return t ? Number(t.porcentaje) : null;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export type RelacionSemanal = {
  desde: string;
  hasta: string;
  gastos_usd: number;
  porcentaje: number | null;
  administracion_usd: number;
  total_a_reponer_usd: number;
  fondos_recibidos_usd: number;
  saldo_usd: number;
};

/**
 * Gastos de la semana (USD) + administración del % vigente. El saldo es lo recibido menos lo
 * que hay que reponer: negativo = el propietario debe enviar más.
 */
export function calcularRelacionSemanal(params: {
  desde: string;
  hasta: string;
  gastos: Array<{ fecha: string; monto_usd: number }>;
  fondos: Array<{ fecha: string; monto_usd: number }>;
  tramos: TramoPorcentaje[];
}): RelacionSemanal {
  const enRango = (f: string) => f >= params.desde && f <= params.hasta;
  const gastos = params.gastos.filter((g) => enRango(g.fecha)).reduce((s, g) => s + (Number(g.monto_usd) || 0), 0);
  const fondos = params.fondos.filter((f) => enRango(f.fecha)).reduce((s, f) => s + (Number(f.monto_usd) || 0), 0);
  // El % se toma del último día de la semana: es el que estaba vigente al cerrarla.
  const porcentaje = porcentajeVigente(params.tramos, params.hasta);
  const admin = porcentaje == null ? 0 : (gastos * porcentaje) / 100;
  const total = gastos + admin;
  return {
    desde: params.desde,
    hasta: params.hasta,
    gastos_usd: redondear(gastos),
    porcentaje,
    administracion_usd: redondear(admin),
    total_a_reponer_usd: redondear(total),
    fondos_recibidos_usd: redondear(fondos),
    saldo_usd: redondear(fondos - total),
  };
}
