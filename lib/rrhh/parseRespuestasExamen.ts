import { generarExamenAdaptativo, PREGUNTAS_PERSONALIDAD } from '@/lib/talento/exam';
import type { PreguntaLogica, PreguntaPersonalidad, RolExamen } from '@/types/talento';

export type RespuestasMap = Record<string, number>;

export type DetalleExamenFuente = 'empleado' | 'invitacion' | 'parcial';

export type DetalleRespuestasExamen = {
  empleadoId: string;
  nombre: string;
  cedula: string;
  rolExamen: RolExamen;
  fuente: DetalleExamenFuente;
  /** true si solo hay snapshot en ci_examenes (tiempo agotado sin submit completo). */
  esParcial: boolean;
  cerradoEn: string | null;
  examenInicioAt: string | null;
  examenCompletadoAt: string | null;
  puntajePersonalidad: number | null;
  puntajeLogica: number | null;
  puntajeTotal: number | null;
  semaforo: string | null;
  statusEvaluacion: string | null;
  motivoSemaforo: string | null;
  perfilColor: string | null;
  gma05: number | null;
  nivelIntegridadRiesgo: number | null;
  completoEnTiempo: boolean | null;
  respuestasPersonalidad: RespuestasMap;
  respuestasLogica: RespuestasMap;
  invitacion: {
    id: string;
    token: string;
    completado: boolean;
    expiraAt: string;
    usadoAt: string | null;
    finAt: string | null;
  } | null;
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Normaliza jsonb: objeto id→valor, array legacy, o anidado en respuestas_json. */
export function parseRespuestasMap(raw: unknown): RespuestasMap {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.respuestas_personalidad && typeof o.respuestas_personalidad === 'object') {
      return parseRespuestasMap(o.respuestas_personalidad);
    }
    if (o.respuestas_logica && typeof o.respuestas_logica === 'object') {
      return parseRespuestasMap(o.respuestas_logica);
    }
    const out: RespuestasMap = {};
    for (const [k, v] of Object.entries(o)) {
      const n = num(v);
      if (n != null) out[k] = n;
    }
    return out;
  }
  return {};
}

export function rolExamenDesdeRow(rol: unknown): RolExamen {
  const r = String(rol ?? '').trim();
  return r === 'programador' ? 'programador' : 'tecnico';
}

export function construirDetalleDesdeFilas(params: {
  empleado: Record<string, unknown>;
  examenInv?: Record<string, unknown> | null;
}): DetalleRespuestasExamen {
  const e = params.empleado;
  const inv = params.examenInv ?? null;

  const rpEmp = parseRespuestasMap(e.respuestas_personalidad);
  const rlEmp = parseRespuestasMap(e.respuestas_logica);

  let rpInv: RespuestasMap = {};
  let rlInv: RespuestasMap = {};
  let cerradoEn: string | null = null;
  if (inv?.respuestas_json != null) {
    const snap = inv.respuestas_json as Record<string, unknown>;
    rpInv = parseRespuestasMap(snap.respuestas_personalidad ?? snap);
    rlInv = parseRespuestasMap(snap.respuestas_logica ?? snap);
    cerradoEn = typeof snap.cerrado_en === 'string' ? snap.cerrado_en : null;
  }

  const tieneEmp = Object.keys(rpEmp).length > 0 || Object.keys(rlEmp).length > 0;
  const tieneInv = Object.keys(rpInv).length > 0 || Object.keys(rlInv).length > 0;

  let fuente: DetalleExamenFuente = 'empleado';
  let rp = rpEmp;
  let rl = rlEmp;
  if (!tieneEmp && tieneInv) {
    fuente = 'invitacion';
    rp = rpInv;
    rl = rlInv;
  } else if (tieneEmp && tieneInv) {
    rp = { ...rpInv, ...rpEmp };
    rl = { ...rlInv, ...rlEmp };
    fuente = 'empleado';
  }

  const examenCompletadoAt = (e.examen_completado_at as string | null) ?? null;
  const invCompletado = Boolean(inv?.completado);
  const esParcial = !examenCompletadoAt && invCompletado && fuente === 'invitacion';

  return {
    empleadoId: String(e.id ?? ''),
    nombre: String(e.nombre_completo ?? '').trim() || 'Sin nombre',
    cedula: String(e.cedula ?? e.documento ?? '').trim() || '—',
    rolExamen: rolExamenDesdeRow(e.rol_examen),
    fuente,
    esParcial,
    cerradoEn,
    examenInicioAt: (e.examen_inicio_at as string | null) ?? null,
    examenCompletadoAt,
    puntajePersonalidad: num(e.puntaje_personalidad),
    puntajeLogica: num(e.puntaje_logica),
    puntajeTotal: num(e.puntaje_total),
    semaforo: (e.semaforo as string | null) ?? null,
    statusEvaluacion: (e.status_evaluacion as string | null) ?? null,
    motivoSemaforo: (e.motivo_semaforo as string | null) ?? null,
    perfilColor: (e.perfil_color as string | null) ?? (e.color_disc as string | null) ?? null,
    gma05: num(e.gma_0_5),
    nivelIntegridadRiesgo: num(e.nivel_integridad_riesgo),
    completoEnTiempo:
      typeof e.completo_en_tiempo === 'boolean' ? e.completo_en_tiempo : null,
    respuestasPersonalidad: rp,
    respuestasLogica: rl,
    invitacion: inv
      ? {
          id: String(inv.id ?? ''),
          token: String(inv.token ?? ''),
          completado: Boolean(inv.completado),
          expiraAt: String(inv.expira_at ?? ''),
          usadoAt: (inv.usado_at as string | null) ?? null,
          finAt: (inv.fin_at as string | null) ?? null,
        }
      : null,
  };
}

export function etiquetasLikert(valor: number): string {
  const map: Record<number, string> = {
    1: 'Totalmente en desacuerdo',
    2: 'En desacuerdo',
    3: 'Neutral',
    4: 'De acuerdo',
    5: 'Totalmente de acuerdo',
  };
  return map[valor] ?? String(valor);
}

export function preguntasParaDetalle(rol: RolExamen): {
  personalidad: PreguntaPersonalidad[];
  logica: PreguntaLogica[];
} {
  const examen = generarExamenAdaptativo(rol) as { logica?: PreguntaLogica[] };
  return {
    personalidad: PREGUNTAS_PERSONALIDAD,
    logica: examen.logica ?? [],
  };
}
