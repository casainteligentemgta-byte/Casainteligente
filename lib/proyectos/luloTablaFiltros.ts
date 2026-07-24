/** Filtra filas por texto en una o todas las columnas (insensible a mayúsculas). */
export function filtrarFilasLulo<T extends Record<string, unknown>>(
  rows: T[],
  columnKeys: string[],
  query: string,
  soloColumna?: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const cols = soloColumna ? [soloColumna] : columnKeys;
  return rows.filter((row) =>
    cols.some((key) => String(row[key] ?? '').toLowerCase().includes(q)),
  );
}

export function valorCeldaLulo(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  return String(v);
}
