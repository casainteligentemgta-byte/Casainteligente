/**
 * Texto legible para listas y selects: muchos registros guardan el nombre comercial
 * en columnas distintas de `nombre` (p. ej. `razon_social`, `nombre_comercial`).
 */
export function etiquetaCliente(row: Record<string, unknown> | null | undefined): string {
  if (!row) return 'Sin nombre';
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };
  const idRaw = row.id;
  const idStr = typeof idRaw === 'string' ? idRaw : idRaw != null ? String(idRaw) : '';
  return (
    pick('nombre', 'razon_social', 'nombre_comercial', 'name', 'business_name', 'email', 'rif') ||
    (idStr ? `Cliente ${idStr.slice(0, 8)}` : 'Sin nombre')
  );
}

export function rifCliente(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  const v = row.rif;
  return typeof v === 'string' ? v.trim() : '';
}

export function idCliente(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  const idRaw = row.id;
  return typeof idRaw === 'string' ? idRaw : idRaw != null ? String(idRaw) : '';
}
