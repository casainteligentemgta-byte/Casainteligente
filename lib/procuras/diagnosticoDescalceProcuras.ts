/** Fila devuelta por RPC `ci_diagnostico_descalce_procuras` (migr. 255). */
export type DiagnosticoDescalceRow = {
  procura_id: string;
  ticket: string | null;
  monto_estimado_usd: number;
  real_ves: number;
  real_usd: number;
  tasa_bcv: number;
  desviacion_usd: number;
};

export function normalizarDiagnosticoDescalce(
  raw: unknown,
): DiagnosticoDescalceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      procura_id: String(r.procura_id ?? ''),
      ticket: r.ticket != null ? String(r.ticket) : null,
      monto_estimado_usd: Number(r.monto_estimado_usd ?? 0),
      real_ves: Number(r.real_ves ?? 0),
      real_usd: Number(r.real_usd ?? 0),
      tasa_bcv: Number(r.tasa_bcv ?? 0),
      desviacion_usd: Number(r.desviacion_usd ?? 0),
    };
  });
}
