import type { AcuerdoPheme, MinutaPheme } from '@/lib/pheme/types';

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
    .filter(Boolean);
}

function asAcuerdos(v: unknown): AcuerdoPheme[] {
  if (!Array.isArray(v)) return [];
  const out: AcuerdoPheme[] = [];
  for (const row of v) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const tarea = String(r.tarea ?? r.compromiso ?? '').trim();
    if (!tarea) continue;
    const responsable = String(r.responsable ?? '').trim() || 'Sin asignar';
    const flRaw = r.fecha_limite ?? r.fechaLimite ?? null;
    const fecha_limite =
      flRaw == null || String(flRaw).trim() === '' || String(flRaw).toLowerCase() === 'null'
        ? null
        : String(flRaw).trim();
    out.push({ tarea, responsable, fecha_limite });
  }
  return out;
}

export function parseMinutaPhemeJson(raw: string): MinutaPheme | null {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const resumen = String(o.resumen_ejecutivo ?? o.resumenEjecutivo ?? '').trim();
  const puntos = asStringArray(o.puntos_clave ?? o.puntosClave);
  const acuerdos = asAcuerdos(o.acuerdos);
  const alertas = asStringArray(o.alertas_pendientes ?? o.alertasPendientes);

  if (!resumen && puntos.length === 0 && acuerdos.length === 0 && alertas.length === 0) {
    return null;
  }

  return {
    resumen_ejecutivo:
      resumen || 'Reunión procesada sin resumen explícito en la respuesta del modelo.',
    puntos_clave: puntos,
    acuerdos,
    alertas_pendientes: alertas,
  };
}
