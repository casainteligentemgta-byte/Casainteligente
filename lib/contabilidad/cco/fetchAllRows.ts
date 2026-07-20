import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE = 1000;

/**
 * PostgREST suele capar en 1000 filas aunque .limit() sea mayor.
 * Pagina con .range() hasta agotar resultados.
 * Importante: el query debe ordenar por clave estable (p.ej. fecha + id);
 * ordenar solo por fecha duplica/omite filas entre páginas.
 */
export async function fetchAllRows<T extends Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: () => { range: (from: number, to: number) => any },
  opts?: { pageSize?: number; maxRows?: number },
): Promise<{ data: T[]; error: { message?: string; code?: string } | null }> {
  const pageSize = opts?.pageSize ?? PAGE;
  const maxRows = opts?.maxRows ?? 50_000;
  const all: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) return { data: all, error };
    const chunk = (data ?? []) as T[];
    if (!chunk.length) break;
    all.push(...chunk);
    if (chunk.length < pageSize || all.length >= maxRows) break;
    from += pageSize;
  }

  return { data: all, error: null };
}

/** Evita doble conteo del import masivo legacy frente al libro CCO-V4. */
export const CCO_ORIGEN_HISTORICO = 'HISTORICO_TABLA';
export const CCO_ORIGEN_V4 = 'cco_v4_import';

export function esIngresoLibroCcoV4(row: {
  creado_por?: string | null;
  origen_fondo?: string | null;
  banco_origen?: string | null;
}): boolean {
  const por = String(row.creado_por ?? '').trim();
  if (por === CCO_ORIGEN_V4) return true;
  const fondo = String(row.origen_fondo ?? '');
  if (/^CCO-V4\b/i.test(fondo)) return true;
  const banco = String(row.banco_origen ?? '').trim().toUpperCase();
  return banco === 'CCO-V4';
}
