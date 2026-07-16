/**
 * Lectura unificada de `ci_entidades.registro_mercantil` (jsonb) para contratos y PDF:
 * claves alternativas, mayúsculas/minúsculas y descarte de “valores” que son etiquetas de formulario.
 */

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** True si el valor no es un dato real (etiqueta, placeholder o ruido). */
export function esEtiquetaOPlaceholderRegistroMercantil(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (/^\[[\s\S]*\]$/.test(t)) return true;
  if (/^[-_.\s…]+$/.test(t)) return true;
  const n = stripAccents(t).toUpperCase();
  const phony = new Set([
    'NUMERO',
    'NÚMERO',
    'NRO',
    'N°',
    'Nº',
    'TOMO',
    'FECHA',
    'FECHA DE INSCRIPCION',
    'FECHA DE INSCRIPCIÓN',
  ]);
  if (phony.has(n)) return true;
  if (/^N[°º.]?$/.test(n)) return true;
  return false;
}

function scalarToTrimmedString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}

function buildKeyIndex(rm: Record<string, unknown>): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const [k, v] of Object.entries(rm)) {
    m.set(stripAccents(k).toLowerCase(), v);
  }
  return m;
}

function pickScalar(idx: Map<string, unknown>, candidates: string[]): string | null {
  for (const c of candidates) {
    const k = stripAccents(c).toLowerCase();
    const s = scalarToTrimmedString(idx.get(k));
    if (s && !esEtiquetaOPlaceholderRegistroMercantil(s)) return s;
  }
  return null;
}

/** Parsea jsonb o string JSON a objeto plano; si no es objeto, null. */
export function parseRegistroMercantilRecord(raw: unknown): Record<string, unknown> | null {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  return o as Record<string, unknown>;
}

/**
 * Si `tomo` / `numero` / `fecha` vienen dentro de un subobjeto (importaciones o clientes viejos),
 * los promueve al primer nivel sin pisar claves ya definidas en la raíz.
 */
export function aplanarRegistroMercantilUnNivel(rm: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!rm) return null;
  const out: Record<string, unknown> = { ...rm };
  for (const [key, val] of Object.entries(rm)) {
    if (key === 'representantes' || val == null || typeof val !== 'object' || Array.isArray(val)) continue;
    const nested = val as Record<string, unknown>;
    for (const [k2, v2] of Object.entries(nested)) {
      const cur = out[k2];
      const curEmpty =
        cur == null || (typeof cur === 'string' && !cur.trim()) || (typeof cur === 'number' && !Number.isFinite(cur));
      if (curEmpty) out[k2] = v2;
    }
  }
  return out;
}

export type CamposRegistroMercantilContrato = {
  circunscripcion: string;
  fecha: string;
  numero: string;
  tomo: string;
};

/**
 * Extrae circunscripción/oficina, fecha (ISO o texto), número y tomo del JSON de registro mercantil.
 */
export function camposRegistroMercantilDesdeRecord(rm: Record<string, unknown> | null): CamposRegistroMercantilContrato {
  if (!rm) return { circunscripcion: '', fecha: '', numero: '', tomo: '' };
  const flat = aplanarRegistroMercantilUnNivel(rm) ?? rm;
  const idx = buildKeyIndex(flat);

  const circ =
    pickScalar(idx, [
      'circunscripcion',
      'registro_mercantil_oficina',
      'oficina',
      'registro',
      'datos_registro',
    ]) ?? '';

  const fecha =
    pickScalar(idx, [
      'fecha',
      'fecha_inscripcion',
      'fecha_registro',
      'fecha_de_inscripcion',
      'fechainscripcion',
      'inscripcion_fecha',
      'fecha_constitucion',
    ]) ?? '';

  const numero =
    pickScalar(idx, [
      'numero',
      'numero_registro',
      'nro',
      'numero_inscripcion',
      'n_inscripcion',
      'nro_inscripcion',
      'numero_registro_mercantil',
      'n_registro',
    ]) ?? '';

  const tomo =
    pickScalar(idx, [
      'tomo',
      'libro_tomo',
      'tomo_libro',
      'tomo_registro',
      'tomo_rm',
      'libro',
    ]) ?? '';

  return {
    circunscripcion: circ.trim(),
    fecha: fecha.trim(),
    numero: numero.trim(),
    tomo: tomo.trim(),
  };
}

export function camposRegistroMercantilContrato(raw: unknown): CamposRegistroMercantilContrato {
  return camposRegistroMercantilDesdeRecord(parseRegistroMercantilRecord(raw));
}

/** Fecha larga es-VE desde ISO `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` o `DD/MM/YYYY` (común en captura manual). */
export function fechaLargaEsDesdeCampoRm(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const ymd = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
    }
  }
  const dmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    const d = new Date(year, month, day, 12, 0, 0);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
    }
  }
  const d2 = new Date(t.includes('T') ? t : `${t}T12:00:00`);
  if (!Number.isNaN(d2.getTime())) {
    return d2.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return null;
}

/** Capitaliza el nombre del mes en una fecha larga tipo «15 de marzo de 2015». */
function capitalizarMesEnFechaLargaEs(s: string): string {
  return s.replace(/\bde\s+([a-záéíóúüñ]+)\s+de\b/i, (_, mes: string) => {
    const m = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();
    return `de ${m} de`;
  });
}

/**
 * Fecha de inscripción en RM para contratos impresos: mes con mayúscula inicial y años 2000–2099 como «2.015».
 */
export function fechaLargaRegistroMercantilContratoVe(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const ymd = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]) - 1;
    const day = Number(ymd[3]);
    const d = new Date(year, month, day, 12, 0, 0);
    if (Number.isNaN(d.getTime())) return fechaLargaEsDesdeCampoRm(raw);
    const dayStr = d.toLocaleDateString('es-VE', { day: 'numeric' });
    let monthStr = d.toLocaleDateString('es-VE', { month: 'long' });
    monthStr = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
    if (year >= 2000 && year <= 2099) {
      return `${dayStr} de ${monthStr} de 2.${String(year).slice(1)}`;
    }
    return `${dayStr} de ${monthStr} de ${d.toLocaleDateString('es-VE', { year: 'numeric' })}`;
  }
  const fallback = fechaLargaEsDesdeCampoRm(t);
  if (!fallback) return null;
  return capitalizarMesEnFechaLargaEs(fallback);
}
