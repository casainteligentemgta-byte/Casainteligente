import { normalizarPlaca, parseFechaIso } from '@/lib/flota/utils';

export const TIPOS_GASOLINA_OCR = ['regular', 'premium', 'diesel'] as const;
export type TipoGasolinaOcr = (typeof TIPOS_GASOLINA_OCR)[number];

export type ExtraccionFacturaGasolina = {
  fecha: string | null;
  litros: number | null;
  monto_usd: number | null;
  monto_bs: number | null;
  estacion: string | null;
  tipo_gasolina: TipoGasolinaOcr | null;
  placa: string | null;
  numero_factura: string | null;
  confianza: number | null;
  es_factura_combustible: boolean;
  notas: string | null;
  factura_url?: string | null;
};

export type CamposFormularioGasolina = {
  maquinaria_id: string;
  cantidad_litros: string;
  costo_total: string;
  tipo_gasolina: string;
  estacion_gasolina: string;
  fecha: string;
  notas: string;
  factura_url?: string;
};

export type ResultadoAplicarOcrGasolina = {
  form: CamposFormularioGasolina;
  avisos: string[];
  campos: string[];
};

const MIME_POR_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

export const MIME_FACTURA_GASOLINA = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

export const MAX_BYTES_FACTURA_GASOLINA = 10 * 1024 * 1024;
const GALON_A_LITRO = 3.785411784;

export function mimeFacturaGasolina(file: { type?: string; name?: string }): string | null {
  const t = file.type?.trim().toLowerCase();
  if (t && MIME_FACTURA_GASOLINA.has(t)) return t;
  const ext = file.name?.split('.').pop()?.toLowerCase();
  return ext ? MIME_POR_EXT[ext] ?? null : null;
}

/** Números VE: 1.250,50 / 1,250.50 / 25,5 / 25.5 */
export function parseNumeroVe(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d,.\-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return null;
  if (s.includes(',') && s.includes('.')) {
    s =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizarFechaFactura(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const iso = parseFechaIso(s);
  if (iso) return iso;
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return parseFechaIso(`${year}-${month}-${day}`);
}

export function normalizarTipoCombustible(raw: unknown): TipoGasolinaOcr | null {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!t) return null;
  if (/diesel|gasoil|gasoleo/.test(t)) return 'diesel';
  if (/\b95\b|premium|super|plus/.test(t)) return 'premium';
  if (/\b91\b|\b87\b|regular/.test(t)) return 'regular';
  if (t === 'gasolina') return 'regular';
  return null;
}

export function normalizarLitros(raw: unknown, unidad?: unknown): number | null {
  const n = parseNumeroVe(raw);
  if (n == null || n <= 0) return null;
  const u = String(unidad ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const litros = /gal/.test(u) ? n * GALON_A_LITRO : n;
  return Math.round(litros * 100) / 100;
}

export function parseJsonFacturaGasolina(text: string): Record<string, unknown> {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* buscar objeto embebido */
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error('La IA no devolvió datos de la factura.');
}

function texto(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  return s ? s : null;
}

function montoPositivo(raw: unknown): number | null {
  const n = parseNumeroVe(raw);
  if (n == null || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function parsearExtraccionFacturaGasolina(raw: unknown): ExtraccionFacturaGasolina {
  const rec =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const litros = normalizarLitros(rec.litros ?? rec.cantidad_litros ?? rec.volumen, rec.unidad_volumen);
  const tipo = normalizarTipoCombustible(rec.tipo_gasolina ?? rec.tipo ?? rec.combustible);
  const confianzaRaw = parseNumeroVe(rec.confianza);
  return {
    fecha: normalizarFechaFactura(rec.fecha ?? rec.date),
    litros,
    monto_usd: montoPositivo(rec.monto_usd ?? rec.total_usd ?? rec.costo_usd),
    monto_bs: montoPositivo(rec.monto_bs ?? rec.total_bs ?? rec.costo_bs),
    estacion: texto(rec.estacion ?? rec.estacion_gasolina ?? rec.estacion_servicio),
    tipo_gasolina: tipo,
    placa: normalizarPlaca(texto(rec.placa ?? rec.placa_vehiculo) ?? '') || null,
    numero_factura: texto(rec.numero_factura ?? rec.invoice_number),
    confianza:
      confianzaRaw == null ? null : Math.min(100, Math.max(0, Math.round(confianzaRaw))),
    es_factura_combustible: rec.es_factura_combustible !== false,
    notas: texto(rec.notas),
  };
}

export function aplicarExtraccionAFormulario(
  form: CamposFormularioGasolina,
  data: ExtraccionFacturaGasolina,
  vehiculos: Array<{ id: string; placa: string }> = [],
): ResultadoAplicarOcrGasolina {
  const next: CamposFormularioGasolina = { ...form };
  const avisos: string[] = [];
  const campos: string[] = [];

  if (data.fecha) {
    next.fecha = data.fecha;
    campos.push('fecha');
  } else {
    avisos.push('No se leyó la fecha. Complétela a mano.');
  }

  if (data.litros != null) {
    next.cantidad_litros = String(data.litros);
    campos.push('litros');
  } else {
    avisos.push('No se leyeron los litros. Complételos a mano.');
  }

  if (data.monto_usd != null) {
    next.costo_total = String(data.monto_usd);
    campos.push('monto');
  } else if (data.monto_bs != null) {
    const notaBs = `Factura Bs ${data.monto_bs}`;
    next.notas = [form.notas, notaBs].filter(Boolean).join(' · ');
    avisos.push(`Monto en bolívares: Bs ${data.monto_bs}. Indique el equivalente en USD.`);
  } else {
    avisos.push('No se leyó el monto. Complételo a mano.');
  }

  if (data.estacion) {
    next.estacion_gasolina = data.estacion;
    campos.push('estación');
  } else {
    avisos.push('No se leyó la estación. Complétela a mano.');
  }

  if (data.tipo_gasolina) {
    next.tipo_gasolina = data.tipo_gasolina;
    campos.push('tipo');
  }

  if (data.placa) {
    const match = vehiculos.find((v) => normalizarPlaca(v.placa) === data.placa);
    if (match) {
      next.maquinaria_id = match.id;
      campos.push('unidad');
    } else {
      avisos.push(`Placa leída: ${data.placa}. Seleccione la unidad.`);
    }
  }

  if (data.factura_url) next.factura_url = data.factura_url;

  return { form: next, avisos, campos };
}
