/** Escala de frecuencia para ítems de personalidad (técnico / programador). Valores 1–4 en BD. */
export const ESCALA_FRECUENCIA_PERSONALIDAD = [
  { valor: 1, etiqueta: 'Nunca' },
  { valor: 2, etiqueta: 'A veces' },
  { valor: 3, etiqueta: 'Casi siempre' },
  { valor: 4, etiqueta: 'Siempre' },
] as const;

export type ValorFrecuenciaPersonalidad = (typeof ESCALA_FRECUENCIA_PERSONALIDAD)[number]['valor'];

const ETIQUETAS: Record<number, string> = Object.fromEntries(
  ESCALA_FRECUENCIA_PERSONALIDAD.map((o) => [o.valor, o.etiqueta]),
);

/** Normaliza respuesta guardada (acepta legado Likert 1–5 → 1–4). */
export function normalizarValorPersonalidad(valor: number): ValorFrecuenciaPersonalidad | null {
  if (!Number.isFinite(valor)) return null;
  const v = Math.round(valor);
  if (v >= 1 && v <= 4) return v as ValorFrecuenciaPersonalidad;
  if (v >= 1 && v <= 5) {
    return Math.min(4, Math.max(1, Math.round(((v - 1) / 4) * 3 + 1))) as ValorFrecuenciaPersonalidad;
  }
  return null;
}

export function etiquetaFrecuenciaPersonalidad(valor: number): string {
  const n = normalizarValorPersonalidad(valor);
  if (n != null) return ETIQUETAS[n] ?? String(n);
  return String(valor);
}

export function respuestaPersonalidadValida(valor: unknown): valor is ValorFrecuenciaPersonalidad {
  return normalizarValorPersonalidad(Number(valor)) != null;
}
