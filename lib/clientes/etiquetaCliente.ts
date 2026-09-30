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

/** Dirección escrita del CRM para precargar la ubicación de un proyecto. */
export function direccionCliente(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  for (const k of ['direccion', 'domicilio', 'address', 'ubicacion'] as const) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function idsClienteIguales(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function numeroOpcional(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** GPS del cliente, si está guardado en el CRM. */
export function coordsCliente(
  row: Record<string, unknown> | null | undefined,
): { lat: number; lng: number } | null {
  if (!row) return null;
  const lat = numeroOpcional(row.latitude ?? row.lat);
  const lng = numeroOpcional(row.longitude ?? row.lng);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
