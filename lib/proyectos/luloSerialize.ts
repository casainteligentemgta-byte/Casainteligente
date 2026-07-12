/** Convierte valores de filas MDB/Access a JSON seguro. */
export function serializeLuloValue(value: unknown): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Buffer) return value.toString('base64');
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      o[k] = serializeLuloValue(v);
    }
    return o;
  }
  if (Array.isArray(value)) return value.map(serializeLuloValue);
  return value;
}

export function serializeLuloRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = serializeLuloValue(v);
  }
  return out;
}

/** Fila Access como objeto o array alineado con nombres de columna. */
export function normalizeMdbTableRow(row: unknown, columnNames: string[]): Record<string, unknown> {
  if (row == null) return {};
  if (Array.isArray(row)) {
    const out: Record<string, unknown> = {};
    columnNames.forEach((col, i) => {
      out[col] = row[i] ?? '';
    });
    return serializeLuloRow(out);
  }
  if (typeof row === 'object') {
    return serializeLuloRow(row as Record<string, unknown>);
  }
  return {};
}
