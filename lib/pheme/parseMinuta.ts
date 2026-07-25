import type { AcuerdoPheme, MinutaPheme } from '@/lib/pheme/types';

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
    .filter(Boolean);
}

function normalizarFechaLimite(flRaw: unknown): string | null {
  if (flRaw == null) return null;
  const s = String(flRaw).trim();
  if (!s || s.toLowerCase() === 'null' || s.toUpperCase() === 'N/A' || s === '—') {
    return null;
  }
  return s;
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
    out.push({
      tarea,
      responsable,
      fecha_limite: normalizarFechaLimite(r.fecha_limite ?? r.fechaLimite),
    });
  }
  return out;
}

/**
 * Limpia fences ```json y parsea al schema Pheme
 * (`pendientes_o_alertas`; acepta alias `alertas_pendientes`).
 */
export function parseMinutaPhemeJson(raw: string): MinutaPheme | null {
  let cleaned = (raw ?? '').trim();
  // Equivalente al prototipo: strip("```json").strip("```")
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

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
  const alertas = asStringArray(
    o.pendientes_o_alertas ?? o.pendientesOAlertas ?? o.alertas_pendientes ?? o.alertasPendientes,
  );

  if (!resumen && puntos.length === 0 && acuerdos.length === 0 && alertas.length === 0) {
    return null;
  }

  return {
    resumen_ejecutivo:
      resumen || 'Reunión procesada sin resumen explícito en la respuesta del modelo.',
    puntos_clave: puntos,
    acuerdos,
    pendientes_o_alertas: alertas,
  };
}
