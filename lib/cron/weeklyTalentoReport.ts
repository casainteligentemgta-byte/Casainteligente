import type { SupabaseClient } from '@supabase/supabase-js';

export type RangoReporte = { desdeIso: string; hastaIso: string; desdeLabel: string; hastaLabel: string };

export type WeeklyTalentoReport = {
  rango: RangoReporte;
  errores: string[];
  requisicionesNuevas: number;
  candidatosNuevos: number;
  clicsVacantesNuevas: number;
  /** Candidatos / clics (vacantes nuevas del período). */
  conversionPct: number;
  contratosEmitidos: number;
  entrevistasTecnicas: number;
  costoOperativoEstimadoVes: number;
  costoPorVagaVes: number;
  tiempoMedioCierreDias: number | null;
  semaforoVerde: number;
  semaforoAmarillo: number;
  semaforoRojo: number;
  discRojo: number;
  discVerde: number;
  discAzul: number;
  discAmarillo: number;
  discOtro: number;
  proyectoMasActivoNombre: string;
  proyectoMasActivoCount: number;
  entidadesFichaIncompleta: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtVES(n: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtNum(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(1);
}

/** Ventana de los últimos 7 días (hasta “ahora”, UTC). Etiquetas en America/Caracas. */
export function rangoUltimos7Dias(): RangoReporte {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 7 * 24 * 60 * 60 * 1000);
  const desdeIso = desde.toISOString();
  const hastaIso = hasta.toISOString();
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Caracas',
  };
  const desdeLabel = desde.toLocaleDateString('es-VE', opts);
  const hastaLabel = hasta.toLocaleDateString('es-VE', opts);
  return { desdeIso, hastaIso, desdeLabel, hastaLabel };
}

function semaforoBucket(row: {
  semaforo_riesgo?: string | null;
  semaforo?: string | null;
}): 'verde' | 'amarillo' | 'rojo' | null {
  const r = (row.semaforo_riesgo ?? '').trim().toLowerCase();
  if (r === 'verde' || r === 'amarillo' || r === 'rojo') return r;
  const s = (row.semaforo ?? '').trim().toLowerCase();
  if (s === 'verde' || s === 'amarillo' || s === 'rojo') return s;
  return null;
}

/**
 * Agrega métricas de `recruitment_needs`, `ci_empleados`, `ci_contratos_empleado_obra`, `ci_proyectos`, `ci_entidades`.
 */
export async function buildWeeklyTalentoReport(
  admin: SupabaseClient,
  rango: RangoReporte = rangoUltimos7Dias(),
): Promise<WeeklyTalentoReport> {
  const errores: string[] = [];
  const { desdeIso, hastaIso } = rango;

  const baseCost = Math.max(0, Number(process.env.RECRUITMENT_BASE_COST_VES ?? 500) || 500);
  const milestoneCost = Math.max(0, Number(process.env.RECRUITMENT_MILESTONE_COST_VES ?? 200) || 200);

  const { data: needs, error: errNeeds } = await admin
    .from('recruitment_needs')
    .select('id, created_at, conteo_clics, proyecto_id, title')
    .gte('created_at', desdeIso)
    .lte('created_at', hastaIso);

  if (errNeeds) errores.push(`recruitment_needs: ${errNeeds.message}`);
  const needsRows = needs ?? [];
  const requisicionesNuevas = needsRows.length;
  const clicsVacantesNuevas = needsRows.reduce((s, r) => s + (typeof r.conteo_clics === 'number' ? r.conteo_clics : 0), 0);

  const { data: empleados, error: errEmp } = await admin
    .from('ci_empleados')
    .select('id, created_at, semaforo, semaforo_riesgo, perfil_color, examen_completado_at, estado')
    .gte('created_at', desdeIso)
    .lte('created_at', hastaIso);

  if (errEmp) errores.push(`ci_empleados: ${errEmp.message}`);
  const empRows = empleados ?? [];
  const candidatosNuevos = empRows.length;

  let semaforoVerde = 0;
  let semaforoAmarillo = 0;
  let semaforoRojo = 0;
  let discRojo = 0;
  let discVerde = 0;
  let discAzul = 0;
  let discAmarillo = 0;
  let discOtro = 0;
  const cierresDias: number[] = [];

  for (const e of empRows) {
    const b = semaforoBucket(e as { semaforo_riesgo?: string | null; semaforo?: string | null });
    if (b === 'verde') semaforoVerde += 1;
    else if (b === 'amarillo') semaforoAmarillo += 1;
    else if (b === 'rojo') semaforoRojo += 1;

    const pc = ((e as { perfil_color?: string | null }).perfil_color ?? '').trim();
    if (pc === 'Rojo') discRojo += 1;
    else if (pc === 'Verde') discVerde += 1;
    else if (pc === 'Azul') discAzul += 1;
    else if (pc === 'Amarillo') discAmarillo += 1;
    else if (pc) discOtro += 1;

    const ex = (e as { examen_completado_at?: string | null }).examen_completado_at;
    const cr = (e as { created_at?: string | null }).created_at;
    if (ex && cr) {
      const t0 = new Date(cr).getTime();
      const t1 = new Date(ex).getTime();
      if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
        cierresDias.push((t1 - t0) / (24 * 60 * 60 * 1000));
      }
    }
  }

  const { count: cntEx, error: errEx } = await admin
    .from('ci_empleados')
    .select('id', { count: 'exact', head: true })
    .gte('examen_completado_at', desdeIso)
    .lte('examen_completado_at', hastaIso);
  if (errEx) errores.push(`entrevistas (examen_completado_at): ${errEx.message}`);
  const entrevistasTecnicas = cntEx ?? 0;

  const { count: cntCtr, error: errCtr } = await admin
    .from('ci_contratos_empleado_obra')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', desdeIso)
    .lte('created_at', hastaIso);
  if (errCtr) errores.push(`contratos: ${errCtr.message}`);
  const contratosEmitidos = cntCtr ?? 0;

  const costoOperativoEstimadoVes = requisicionesNuevas * baseCost + contratosEmitidos * milestoneCost;
  const costoPorVagaVes = requisicionesNuevas > 0 ? costoOperativoEstimadoVes / requisicionesNuevas : costoOperativoEstimadoVes;

  const conversionPct = clicsVacantesNuevas > 0 ? (candidatosNuevos / clicsVacantesNuevas) * 100 : candidatosNuevos > 0 ? 100 : 0;

  const tiempoMedioCierreDias =
    cierresDias.length > 0 ? cierresDias.reduce((a, b) => a + b, 0) / cierresDias.length : null;

  const byProyecto = new Map<string, number>();
  for (const n of needsRows) {
    const pid = n.proyecto_id as string | null;
    if (!pid) continue;
    byProyecto.set(pid, (byProyecto.get(pid) ?? 0) + 1);
  }
  let proyectoMasActivoNombre = '—';
  let proyectoMasActivoCount = 0;
  let topPid: string | null = null;
  for (const [pid, c] of Array.from(byProyecto.entries())) {
    if (c > proyectoMasActivoCount) {
      proyectoMasActivoCount = c;
      topPid = pid;
    }
  }
  if (topPid) {
    const { data: obra, error: errOb } = await admin.from('ci_proyectos').select('nombre').eq('id', topPid).maybeSingle();
    if (errOb) errores.push(`ci_proyectos: ${errOb.message}`);
    else if (obra && typeof (obra as { nombre?: string }).nombre === 'string') {
      proyectoMasActivoNombre = (obra as { nombre: string }).nombre;
    }
  }

  const { data: entidades, error: errEnt } = await admin
    .from('ci_entidades')
    .select('id, rif, registro_mercantil');
  if (errEnt) errores.push(`ci_entidades: ${errEnt.message}`);
  let entidadesFichaIncompleta = 0;
  for (const ent of entidades ?? []) {
    const rif = ((ent as { rif?: string | null }).rif ?? '').trim();
    const rm = ((ent as { registro_mercantil?: string | null }).registro_mercantil ?? '').trim();
    if (!rif || !rm) entidadesFichaIncompleta += 1;
  }

  return {
    rango,
    errores,
    requisicionesNuevas,
    candidatosNuevos,
    clicsVacantesNuevas,
    conversionPct,
    contratosEmitidos,
    entrevistasTecnicas,
    costoOperativoEstimadoVes,
    costoPorVagaVes,
    tiempoMedioCierreDias,
    semaforoVerde,
    semaforoAmarillo,
    semaforoRojo,
    discRojo,
    discVerde,
    discAzul,
    discAmarillo,
    discOtro,
    proyectoMasActivoNombre,
    proyectoMasActivoCount,
    entidadesFichaIncompleta,
  };
}

export function formatTelegramWeeklyTalentoReport(rep: WeeklyTalentoReport): string {
  const periodo = `${escapeHtml(rep.rango.desdeLabel)} → ${escapeHtml(rep.rango.hastaLabel)}`;
  const errBlock =
    rep.errores.length > 0
      ? `\n\n⚠️ <b>Advertencias de lectura</b>\n${rep.errores.map((e) => `• ${escapeHtml(e)}`).join('\n')}`
      : '';

  const tCierre = fmtNum(rep.tiempoMedioCierreDias);

  return (
    `📈 <b>REPORTE SEMANAL DE TALENTO — CASA INTELIGENTE</b>\n` +
    `<i>Elite Black · ERP automático</i>\n\n` +
    `📅 <b>Periodo:</b> ${periodo}\n\n` +
    `🏗 <b>OPERACIONES</b>\n` +
    `• Requisiciones nuevas: <b>${rep.requisicionesNuevas}</b>\n` +
    `• Entrevistas técnicas (examen cerrado en ventana): <b>${rep.entrevistasTecnicas}</b>\n` +
    `• Contratos emitidos: <b>${rep.contratosEmitidos}</b>\n\n` +
    `📊 <b>MÉTRICAS DE EFICIENCIA</b>\n` +
    `• Candidatos captados (nuevos en 7d): <b>${rep.candidatosNuevos}</b>\n` +
    `• Clics (suma en vacantes <u>nuevas</u> del período): <b>${rep.clicsVacantesNuevas}</b>\n` +
    `• Conversión (candidatos / clics vacantes nuevas): <b>${fmtPct(rep.conversionPct)}</b>\n` +
    `• Costo operativo estimado: <b>${fmtVES(rep.costoOperativoEstimadoVes)} VES</b>\n` +
    `• Costo p/vaga (estimado): <b>${fmtVES(rep.costoPorVagaVes)} VES</b>\n` +
    `• Tiempo medio de cierre (CV→examen): <b>${tCierre} días</b>\n` +
    `• Salud de cuadrilla (semáforo, candidatos nuevos): 🟢 ${rep.semaforoVerde} | 🟡 ${rep.semaforoAmarillo} | 🔴 ${rep.semaforoRojo}\n` +
    `• DISC (perfil_color en nuevos): 🔴${rep.discRojo} 🟢${rep.discVerde} 🔵${rep.discAzul} 🟡${rep.discAmarillo}` +
    (rep.discOtro ? ` · otros ${rep.discOtro}` : '') +
    `\n\n` +
    `🏆 <b>Proyecto más activo (requisiciones nuevas):</b> ${escapeHtml(rep.proyectoMasActivoNombre)}` +
    (rep.proyectoMasActivoCount > 0 ? ` <i>(${rep.proyectoMasActivoCount})</i>` : '') +
    `\n\n` +
    `⚖️ <b>Cumplimiento legal (heurística):</b> ${rep.entidadesFichaIncompleta} entidad(es) sin RIF o registro mercantil en ficha.` +
    `\n\n` +
    `🧠 <i>Fuentes: recruitment_needs, ci_empleados, ci_contratos_empleado_obra, ci_proyectos, ci_entidades. Costos vía env RECRUITMENT_BASE_COST_VES / RECRUITMENT_MILESTONE_COST_VES.</i>` +
    errBlock
  );
}
