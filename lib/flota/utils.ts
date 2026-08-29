export const FLOTA_MIGRACION = '313_ci_flota.sql';

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TIPOS_VEHICULO = [
  'auto',
  'camioneta',
  'camion',
  'moto',
  'maquinaria',
  'otro',
] as const;

export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number];

export const TIPOS_LICENCIA = ['2da', '3ra', '4ta', '5ta', 'especial'] as const;

export const TIPOS_DOCUMENTO_CONDUCTOR = [
  'licencia',
  'certificado_medico',
  'cedula',
  'seguro',
  'otro',
] as const;

export const TIPOS_MANTENIMIENTO = [
  'preventivo',
  'correctivo',
  'cambio_aceite',
  'gomas',
  'frenos',
  'revision',
  'otro',
] as const;

export const TIPOS_ALERTA_CONFIG = [
  'licencia_vence',
  'certificado_vence',
  'documento_vence',
  'mantenimiento_fecha',
  'mantenimiento_km',
  'consumo_alto',
] as const;

export type TipoAlertaConfig = (typeof TIPOS_ALERTA_CONFIG)[number];

export type FlotaVehiculo = {
  id: string;
  entidad_id: string | null;
  proyecto_id: string | null;
  placa: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  tipo: TipoVehiculo;
  color: string | null;
  odometro_km: number;
  capacidad_tanque_litros: number | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export const VEHICULO_SELECT =
  'id, entidad_id, proyecto_id, placa, marca, modelo, anio, tipo, color, odometro_km, capacidad_tanque_litros, activo, notas, created_at, updated_at';

export function esUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value.trim()));
}

export function esMigracionPendiente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /does not exist|schema cache|column .* does not exist/i.test(error.message ?? '');
}

export function normalizarPlaca(raw: string | null | undefined): string {
  return (raw ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export function parseNumero(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

export function parseNumeroRequerido(value: unknown, campo: string): number {
  const n = parseNumero(value);
  if (n == null) throw new Error(`${campo} inválido`);
  return n;
}

export function parseFechaIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : s;
}

export function hoyIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Días hasta una fecha YYYY-MM-DD. Negativo = ya venció. */
export function diasHasta(fechaIso: string | null | undefined, now = new Date()): number | null {
  const f = parseFechaIso(fechaIso);
  if (!f) return null;
  const target = new Date(`${f}T12:00:00`);
  const today = new Date(`${hoyIso(now)}T12:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatoFechaVe(fechaIso: string | null | undefined): string {
  const f = parseFechaIso(fechaIso);
  if (!f) return '—';
  return new Date(`${f}T12:00:00`).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatoMonedaUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatoBs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `Bs ${new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(n)}`;
}

export function etiquetaVehiculo(v: {
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
}): string {
  const placa = v.placa?.trim() || 's/placa';
  const extra = [v.marca, v.modelo].filter(Boolean).join(' ');
  return extra ? `${placa} · ${extra}` : placa;
}

export function partirNombreCompleto(nombre: string): { nombres: string; apellidos: string } {
  const parts = nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { nombres: '', apellidos: '' };
  if (parts.length === 1) return { nombres: parts[0], apellidos: '' };
  if (parts.length === 2) return { nombres: parts[0], apellidos: parts[1] };
  return { nombres: parts.slice(0, -2).join(' '), apellidos: parts.slice(-2).join(' ') };
}

export function unirNombreCompleto(
  nombres?: string | null,
  apellidos?: string | null,
): string {
  return [nombres, apellidos].filter(Boolean).join(' ').trim();
}

export function etiquetaConductor(c: {
  nombre_completo?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
}): string {
  const full = c.nombre_completo?.trim() || unirNombreCompleto(c.nombres, c.apellidos);
  return full || 'Conductor';
}

export function fechaLicenciaConductor(c: {
  fecha_vencimiento_licencia?: string | null;
  licencia_vence?: string | null;
}): string | null {
  return c.fecha_vencimiento_licencia ?? c.licencia_vence ?? null;
}

export function fechaSaludConductor(c: {
  fecha_vencimiento_salud?: string | null;
  certificado_medico_vence?: string | null;
}): string | null {
  return c.fecha_vencimiento_salud ?? c.certificado_medico_vence ?? null;
}

export type ConsumoPromedioGasolina = {
  consumo_promedio_km: number;
  consumo_total: number;
  km_recorridos: number;
};

function kmDeRegistroGasolina(row: {
  km_actual?: number | null;
  odometro_km?: number | null;
}): number | null {
  const v = row.km_actual ?? row.odometro_km;
  if (v == null || v === ('' as unknown)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Filas más nuevas primero. litros/km entre cargas consecutivas → L/km. */
export function calcularConsumoDesdeRegistros(
  rows: Array<{
    cantidad_litros?: number | null;
    litros?: number | null;
    km_actual?: number | null;
    odometro_km?: number | null;
  }>,
): ConsumoPromedioGasolina {
  let consumo_total = 0;
  let km_recorridos = 0;

  if (rows.length > 1) {
    for (let i = 0; i < rows.length - 1; i++) {
      consumo_total += Number(rows[i].cantidad_litros ?? rows[i].litros ?? 0);
      const kmNuevo = kmDeRegistroGasolina(rows[i]);
      const kmViejo = kmDeRegistroGasolina(rows[i + 1]);
      if (kmNuevo != null && kmViejo != null) {
        km_recorridos += kmNuevo - kmViejo;
      }
    }
  }

  return {
    consumo_promedio_km: km_recorridos > 0 ? consumo_total / km_recorridos : 0,
    consumo_total,
    km_recorridos,
  };
}

/** km/l entre dos cargas consecutivas del mismo vehículo. */
export function consumoKmPorLitro(params: {
  odometroAnterior: number | null | undefined;
  odometroActual: number | null | undefined;
  litros: number;
}): number | null {
  const prev = params.odometroAnterior;
  const curr = params.odometroActual;
  if (prev == null || curr == null || !Number.isFinite(params.litros) || params.litros <= 0) {
    return null;
  }
  const delta = curr - prev;
  if (delta <= 0) return null;
  return Math.round((delta / params.litros) * 100) / 100;
}

export function partirTextoEnChunks(text: string, chunkSize = 900, overlap = 80): string[] {
  const cleaned = (text || '').replace(/\r/g, '').trim();
  if (!cleaned) return [];
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(cleaned.length, i + chunkSize);
    let slice = cleaned.slice(i, end);
    if (end < cleaned.length) {
      const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '), slice.lastIndexOf('\n'));
      if (lastBreak > chunkSize * 0.5) slice = slice.slice(0, lastBreak + 1);
    }
    const trimmed = slice.trim();
    if (trimmed) chunks.push(trimmed);
    const step = Math.max(1, trimmed.length - overlap);
    i += step;
  }
  return chunks;
}

export function puntuacionBusqueda(texto: string, query: string): number {
  const hay = texto.toLowerCase();
  const tokens = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (!tokens.length) return hay.includes(query.toLowerCase()) ? 1 : 0;
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += 1;
  }
  return score / tokens.length;
}
