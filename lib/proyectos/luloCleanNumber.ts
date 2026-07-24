import { clampNumeric15_4 } from '@/lib/utils/numericDbLimits';

/**
 * Limpia valores numéricos simples (legacy). Preferir `parseLuloNumber` para texto Access.
 */
export function cleanNum(val: unknown): number {
  const n = Number(String(val ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Lee número desde celda Access (number, string, Buffer OLE, etc.). */
export function parseLuloValueUnknown(val: unknown): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (Math.abs(val) >= 1e13) return 0;
    return clampNumeric15_4(val);
  }
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(val)) {
    const s = val.toString('utf8').replace(/\0/g, '').trim();
    if (!s) return 0;
    return parseLuloNumber(s);
  }
  return parseLuloNumber(String(val));
}

/** Números Access/Lulo: 1.234,56 · 1234.56 · 1234,56 · $ 1.234,56 */
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
  t = t.replace(/[^0-9.-]/g, '');
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 1e13) return 0;
  return clampNumeric15_4(n);
}
