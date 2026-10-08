/**
 * Lee el test unificado guardado en `evaluacion_obrero_respuestas`
 * y lo arma para el informe de RRHH (respuestas + resultado).
 */

import { bancoEvaluacionUnificadaObrero } from '@/lib/talento/bancoEvaluacionUnificadaObrero';
import { evaluarSemaforoObrero } from '@/lib/talento/evaluarSemaforoObrero';
import type { ColorPerfilObrero } from '@/lib/talento/evaluacionObrero';

export type RespuestasUnificada = {
  disc: Record<string, string>;
  logica: Record<string, number>;
  confiabilidad: Record<string, number>;
  abc: Record<string, string>;
  familia: string | null;
  track: string | null;
  etiquetaTrack: string | null;
  unificada: boolean;
};

export type ItemInformeRespuesta = {
  id: string;
  seccion: string;
  pregunta: string;
  respondio: string;
  detalle?: string;
  ok?: boolean | null;
};

export type InformeEvaluacionArmado = {
  respuestas: RespuestasUnificada;
  items: ItemInformeRespuesta[];
  resultado: {
    semaforo: string | null;
    estado: string | null;
    motivo: string | null;
    perfilColor: string | null;
    puntajeTotal: number | null;
    puntajePersonalidad: number | null;
    puntuacionLogica: number | null;
    puntuacionConfiabilidad: number | null;
    abcA: number;
    abcB: number;
    abcC: number;
    etiquetaBanco: string | null;
  };
};

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function strMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec(raw))) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) out[k] = s;
  }
  return out;
}

function numMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec(raw))) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export function parseEvaluacionObreroRespuestas(raw: unknown): RespuestasUnificada {
  const o = rec(raw);
  const abcDesdePersonalidad = strMap(o.abc);
  return {
    disc: strMap(o.disc),
    logica: numMap(o.logica),
    confiabilidad: numMap(o.confiabilidad),
    abc: abcDesdePersonalidad,
    familia: typeof o.familia === 'string' ? o.familia : null,
    track: typeof o.track === 'string' ? o.track : null,
    etiquetaTrack: typeof o.etiquetaTrack === 'string' ? o.etiquetaTrack : null,
    unificada: o.unificada === true || Object.keys(strMap(o.disc)).length > 0,
  };
}

/** ABC guardado suelto en `respuestas_personalidad` ({ obr_01: 'A' }). */
export function parseRespuestasAbc(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec(raw))) {
    const s = String(v ?? '')
      .trim()
      .toUpperCase();
    if (s === 'A' || s === 'B' || s === 'C') out[k] = s;
  }
  return out;
}

export function armarInformeEvaluacionUnificada(opts: {
  evaluacionRaw?: unknown;
  respuestasPersonalidad?: unknown;
  cargo?: string | null;
  codigoGoE?: string | null;
  rolExamen?: string | null;
  semaforo?: string | null;
  motivoSemaforo?: string | null;
  perfilColor?: string | null;
  puntajeTotal?: number | null;
  puntajePersonalidad?: number | null;
  puntuacionLogica?: number | null;
  puntuacionConfiabilidad?: number | null;
  statusEvaluacion?: string | null;
}): InformeEvaluacionArmado {
  const parsed = parseEvaluacionObreroRespuestas(opts.evaluacionRaw);
  const abcPersonalidad = parseRespuestasAbc(opts.respuestasPersonalidad);
  if (!Object.keys(parsed.abc).length && Object.keys(abcPersonalidad).length) {
    parsed.abc = abcPersonalidad;
  }

  const banco = bancoEvaluacionUnificadaObrero({
    cargo: opts.cargo,
    codigoGoE: opts.codigoGoE,
    rolExamen: opts.rolExamen ?? 'obrero',
  });

  const items: ItemInformeRespuesta[] = [];

  for (const q of banco.disc) {
    const color = parsed.disc[q.id] as ColorPerfilObrero | undefined;
    const opt = q.opciones.find((o) => o.color === color);
    items.push({
      id: q.id,
      seccion: 'Cómo eres en la obra',
      pregunta: q.pregunta,
      respondio: opt?.texto ?? (color ? `Color ${color}` : 'Sin respuesta'),
      detalle: color ?? undefined,
    });
  }

  for (const q of banco.logica) {
    const idx = parsed.logica[q.id];
    const texto = typeof idx === 'number' ? q.opciones[idx] ?? `Opción ${idx + 1}` : 'Sin respuesta';
    items.push({
      id: q.id,
      seccion: 'Preguntas de obra',
      pregunta: q.texto,
      respondio: texto,
      ok: typeof idx === 'number' ? idx === q.correcta : null,
    });
  }

  for (const q of banco.confiabilidad) {
    const idx = parsed.confiabilidad[q.id];
    const texto = typeof idx === 'number' ? q.opciones[idx] ?? `Opción ${idx + 1}` : 'Sin respuesta';
    items.push({
      id: q.id,
      seccion: 'Honestidad',
      pregunta: q.texto,
      respondio: texto,
      ok: typeof idx === 'number' ? idx === q.mejor : null,
    });
  }

  for (const q of banco.abc) {
    const letra = (parsed.abc[q.id] ?? '').toUpperCase();
    const opt = q.opciones.find((o) => o.valor.toUpperCase() === letra);
    items.push({
      id: q.id,
      seccion: banco.etiquetaFamilia ? `En la obra · ${banco.etiquetaFamilia}` : 'En la obra',
      pregunta: q.pregunta,
      respondio: opt ? `${letra}) ${opt.texto}` : letra || 'Sin respuesta',
      ok: letra ? letra === 'A' : null,
    });
  }

  const semaforoAbc = Object.keys(parsed.abc).length ? evaluarSemaforoObrero(parsed.abc) : null;

  return {
    respuestas: parsed,
    items,
    resultado: {
      semaforo: opts.semaforo ?? semaforoAbc?.semaforo ?? null,
      estado: opts.statusEvaluacion ?? semaforoAbc?.estado ?? null,
      motivo: opts.motivoSemaforo ?? semaforoAbc?.motivo ?? null,
      perfilColor: opts.perfilColor ?? null,
      puntajeTotal: opts.puntajeTotal ?? semaforoAbc?.puntaje_total ?? null,
      puntajePersonalidad: opts.puntajePersonalidad ?? semaforoAbc?.puntaje_personalidad ?? null,
      puntuacionLogica: opts.puntuacionLogica ?? null,
      puntuacionConfiabilidad: opts.puntuacionConfiabilidad ?? null,
      abcA: semaforoAbc?.resumen.respuestasA ?? 0,
      abcB: semaforoAbc?.resumen.respuestasB ?? 0,
      abcC: semaforoAbc?.resumen.respuestasC ?? 0,
      etiquetaBanco: parsed.etiquetaTrack ?? banco.etiquetaFamilia ?? null,
    },
  };
}
