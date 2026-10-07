/** Lunes (ISO) de la semana que contiene `iso` (YYYY-MM-DD). */
export function lunesDeSemanaIso(iso: string): string {
  const s = iso.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const t = new Date();
    return lunesDeSemanaIso(t.toISOString().slice(0, 10));
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const day = dt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export function domingoDeSemanaIso(lunesIso: string): string {
  const lunes = lunesDeSemanaIso(lunesIso);
  const [y, mo, d] = lunes.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + 6));
  return dt.toISOString().slice(0, 10);
}

export function esMigracionNomina333Pendiente(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase();
  if (!m) return false;
  return (
    (m.includes('ci_nomina_periodos') ||
      m.includes('ci_nomina_items') ||
      m.includes('ci_prestaciones_saldo') ||
      m.includes('ci_prestaciones_adelantos')) &&
    (m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find'))
  );
}
