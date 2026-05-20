import { normalizeColumnKey, pickFieldFuzzy } from '@/lib/proyectos/luloColumnInfer';

/** Normaliza filas CSV/MDB a mapa clave→texto en minúsculas (claves sin acentos). */
export function normalizeLuloRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = normalizeColumnKey(k);
    if (v == null || v === '') {
      out[key] = '';
      continue;
    }
    if (v instanceof Date) {
      out[key] = v.toISOString().slice(0, 10);
      continue;
    }
    if (typeof v === 'boolean') {
      out[key] = v ? '1' : '0';
      continue;
    }
    out[key] = String(v).trim();
  }
  return out;
}

export function pickField(row: Record<string, string>, keys: string[]): string {
  return pickFieldFuzzy(row, keys);
}

export function pickNumber(row: Record<string, string>, keys: string[]): number {
  const raw = pickFieldFuzzy(row, keys).replace(/\s/g, '').replace(/,/g, '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function pickFecha(row: Record<string, string>, keys: string[]): string {
  const raw = pickField(row, keys);
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}
