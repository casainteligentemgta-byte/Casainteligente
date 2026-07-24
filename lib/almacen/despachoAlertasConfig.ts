/** Umbrales de alertas en despacho (exceso presupuestario / saldo sin asignar). */

export type DespachoAlertasConfig = {
  /** % de exceso sobre techo para advertencia (ej. 5 → 5%). */
  excesoAdvertenciaPct: number;
  /** % de exceso sobre techo para alerta crítica. */
  excesoCriticoPct: number;
  /** Si el saldo sin imputar supera este % de la línea, mostrar aviso informativo. */
  saldoInformativoPct: number;
};

export const DESPACHO_ALERTAS_DEFAULT: DespachoAlertasConfig = {
  excesoAdvertenciaPct: 5,
  excesoCriticoPct: 15,
  saldoInformativoPct: 10,
};

export type NivelAlertaDespacho = 'ok' | 'info' | 'advertencia' | 'critico';

export function nivelAlertaExceso(
  porcentajeExceso: number,
  config: DespachoAlertasConfig = DESPACHO_ALERTAS_DEFAULT,
): NivelAlertaDespacho {
  if (porcentajeExceso <= 0) return 'ok';
  if (porcentajeExceso >= config.excesoCriticoPct) return 'critico';
  if (porcentajeExceso >= config.excesoAdvertenciaPct) return 'advertencia';
  return 'info';
}

export function nivelAlertaSaldo(
  saldo: number,
  cantidadLinea: number,
  config: DespachoAlertasConfig = DESPACHO_ALERTAS_DEFAULT,
): NivelAlertaDespacho {
  if (saldo <= 0.0001 || cantidadLinea <= 0) return 'ok';
  const pct = (saldo / cantidadLinea) * 100;
  if (pct >= config.saldoInformativoPct) return 'info';
  return 'ok';
}
