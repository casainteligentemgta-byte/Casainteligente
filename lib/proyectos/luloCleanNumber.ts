import { clampNumeric15_4 } from '@/lib/utils/numericDbLimits';

/**
 * Limpia valores numéricos simples (legacy). Preferir `parseLuloNumber` para texto Access.
 */
export function cleanNum(val: unknown): number {
  const n = Number(String(val ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
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
