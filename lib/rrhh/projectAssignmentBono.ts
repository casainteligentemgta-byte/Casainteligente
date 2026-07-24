/** Parsea monto de bono USD desde texto (coma o punto decimal). */
export function parseBonoUsd(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '.');
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function formatBonoUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  return String(Math.round(n * 100) / 100);
}

export function isBonoColumnMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('bono_usd') || (m.includes('column') && m.includes('does not exist'));
}
