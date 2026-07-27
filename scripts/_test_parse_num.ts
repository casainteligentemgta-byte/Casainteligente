export function parseNumeroCsv(v: unknown): number | null {
  if (v == null || v === '') return null;
  let s = String(v).trim().replace(/\s/g, '');
  if (!s || /^nan$/i.test(s) || s === 'None' || s === 'null') return null;

  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // VE: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // VE decimal: 1234,56
    s = s.replace(',', '.');
  } else {
    // US format or integer: 433.875 -> 433.875
    // Do nothing, let Number() handle it
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

console.log(parseNumeroCsv('433.875')); // 433.875
console.log(parseNumeroCsv('1.234,56')); // 1234.56
console.log(parseNumeroCsv('1,234.56')); // 1234.56
console.log(parseNumeroCsv('1234,56')); // 1234.56
console.log(parseNumeroCsv('1234.56')); // 1234.56
console.log(parseNumeroCsv('647265')); // 647265
