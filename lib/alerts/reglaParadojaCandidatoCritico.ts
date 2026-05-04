/**
 * «Regla de Paradoja»: candidato con mucha experiencia pero semáforo de riesgo en rojo.
 * Disparar revisión ejecutiva (p. ej. Telegram al CEO).
 */

export type EntradaReglaParadoja = {
  semaforo_riesgo: string | null | undefined;
  /** Años de experiencia (`ci_empleados.anos_experiencia`). */
  anos_experiencia: number | null | undefined;
};

function normSemaforo(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/**
 * @returns true si debe enviarse alerta de «Candidato de Interés Crítico».
 */
export function cumpleReglaParadojaCritica(entrada: EntradaReglaParadoja): boolean {
  if (normSemaforo(entrada.semaforo_riesgo) !== 'rojo') return false;
  const años = entrada.anos_experiencia;
  if (typeof años !== 'number' || !Number.isFinite(años)) return false;
  return años >= 10;
}
