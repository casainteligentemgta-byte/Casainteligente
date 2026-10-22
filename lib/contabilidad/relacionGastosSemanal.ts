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
  /** Compras registradas. honorarios_usd = administración ya cobrada en esa compra (no se repite). */
  gastos: Array<{ fecha: string; monto_usd: number; honorarios_usd?: number | null }>;
  /** Abonos del propietario (ci_proyecto_abonos). */
  fondos: Array<{ fecha: string; monto_usd: number }>;
  tramos: TramoPorcentaje[];
}): RelacionSemanal {
  const enRango = (f: string) => f >= params.desde && f <= params.hasta;
  const enSemana = params.gastos.filter((g) => enRango(g.fecha));
  const gastos = enSemana.reduce((s, g) => s + (Number(g.monto_usd) || 0), 0);
  const fondos = params.fondos.filter((f) => enRango(f.fecha)).reduce((s, f) => s + (Number(f.monto_usd) || 0), 0);
  // El % se toma del último día de la semana: es el que estaba vigente al cerrarla.
  const porcentaje = porcentajeVigente(params.tramos, params.hasta);
  // Compras con honorarios ya traen su administración; el resto se calcula con el %.
  const conHonorarios = enSemana.filter((g) => g.honorarios_usd != null && Number(g.honorarios_usd) > 0);
  const adminYaCobrada = conHonorarios.reduce((s, g) => s + Number(g.honorarios_usd), 0);
  const baseSinHonorarios = enSemana
    .filter((g) => !(g.honorarios_usd != null && Number(g.honorarios_usd) > 0))
    .reduce((s, g) => s + (Number(g.monto_usd) || 0), 0);
  const adminCalculada = porcentaje == null ? 0 : (baseSinHonorarios * porcentaje) / 100;
  const admin = adminYaCobrada + adminCalculada;
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
