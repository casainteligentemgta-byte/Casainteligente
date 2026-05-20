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
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = String(v);
      continue;
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) {
      const s = v.toString('utf8').replace(/\0/g, '').trim();
      out[key] = s.length > 0 && s.length < 8000 ? s : '';
      continue;
    }
    out[key] = String(v).trim();
  }
  return out;
}

export function pickField(row: Record<string, string>, keys: string[]): string {
  return pickFieldFuzzy(row, keys);
}

/** Números Access/Lulo: 1.234,56 · 1234.56 · 1234,56 */
export function parseLuloNumber(raw: string): number {
  let t = raw.trim().replace(/\s/g, '');
  if (!t || t === '-' || t === '—') return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/,/.test(t) && /\./.test(t)) {
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    if (lastComma > lastDot) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else {
      t = t.replace(/,/g, '');
    }
  } else {
    t = t.replace(/,/g, '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function pickNumber(row: Record<string, string>, keys: string[]): number {
  return parseLuloNumber(pickFieldFuzzy(row, keys));
}

export function pickFecha(row: Record<string, string>, keys: string[]): string {
  const raw = pickField(row, keys);
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}
