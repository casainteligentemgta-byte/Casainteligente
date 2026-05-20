/**
 * Limpia valores numéricos de Access/Lulo (moneda, espacios, símbolos)
 * antes de persistir en Supabase.
 */
export function cleanNum(val: unknown): number {
  const n = Number(String(val ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
