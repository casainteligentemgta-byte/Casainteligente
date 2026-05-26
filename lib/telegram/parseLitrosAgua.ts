/** Parsea litros desde mensaje de texto del obrero (ej. 1500, 1.500, 1500 L). */
export function parseLitrosEntregados(texto: string): number | null {
  const limpio = texto.trim().toLowerCase().replace(/litros?|lts?|\bl\b/gi, '').trim();
  const match = limpio.match(/[\d.,]+/);
  if (!match) return null;

  const num = match[0];
  let valor: number;

  if (num.includes(',') && num.includes('.')) {
    valor = Number(num.replace(/\./g, '').replace(',', '.'));
  } else if (num.includes(',')) {
    const [a, b] = num.split(',');
    valor = b?.length === 3 ? Number(a + b) : Number(`${a}.${b}`);
  } else if (num.includes('.')) {
    const [a, b] = num.split('.');
    valor = b?.length === 3 ? Number(a + b) : Number(num);
  } else {
    valor = Number(num);
  }

  if (!Number.isFinite(valor) || valor <= 0 || valor > 999_999) return null;
  return Math.round(valor * 100) / 100;
}
