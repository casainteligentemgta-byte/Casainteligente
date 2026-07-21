import type { SupabaseClient } from '@supabase/supabase-js';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Capítulos tipo módulo (base de m² para $/m²). */
export function esCapituloModulo(nombre: string): boolean {
  return /\bm[oó]dulo\b/i.test(String(nombre ?? '').trim());
}

/**
 * Estimado efectivo para proyección V4:
 * si no hay estimado guardado, se proyecta con el ejecutado (100 % / restante 0).
 */
export function estimadoProyectado(estimado: number, ejecutado: number): number {
  return estimado > 0 ? estimado : ejecutado;
}

export type CcoPresupuestoFila = {
  id: string;
  capitulo: string;
  subcapitulo: string | null;
  descripcion: string | null;
  estimado_usd: number;
  /** Estimado usado en KPIs/gráfico (estimado o ejecutado si estimado=0). */
  estimado_proyectado_usd: number;
  ejecutado_usd: number;
  saldo_usd: number;
  pct_ejecutado: number;
  area_m2: number;
  es_modulo: boolean;
  ejecutado_usd_m2: number | null;
  estimado_usd_m2: number | null;
};

export type CcoPresupuestosResumen = {
  filas: CcoPresupuestoFila[];
  totalEstimado: number;
  totalEjecutado: number;
  totalSaldo: number;
  avancePct: number;
  areaTotalM2: number;
  areaModulosM2: number;
  costoRealM2: number | null;
  costoProyectadoM2: number | null;
  analisisM2: {
    modulosEjecutado: number;
    modulosEstimado: number;
    obrasEjecutado: number;
    obrasEstimado: number;
    modulosEjecutadoM2: number | null;
    modulosEstimadoM2: number | null;
    obrasEjecutadoM2: number | null;
    obrasEstimadoM2: number | null;
    modulosRestanteM2: number | null;
    obrasRestanteM2: number | null;
    totalRestanteM2: number | null;
    costoTotalRealM2: number | null;
    costoTotalProyectadoM2: number | null;
  };
};

function buildFila(opts: {
  id: string;
  capitulo: string;
  subcapitulo: string | null;
  descripcion: string | null;
  estimado: number;
  ejecutado: number;
  area_m2: number;
}): CcoPresupuestoFila {
  const estimadoProj = estimadoProyectado(opts.estimado, opts.ejecutado);
  const saldo = estimadoProj - opts.ejecutado;
  const pct =
    estimadoProj > 0
      ? Math.min(999, Math.round((opts.ejecutado / estimadoProj) * 10000) / 100)
      : 0;
  const area = Math.max(0, opts.area_m2);
  return {
    id: opts.id,
    capitulo: opts.capitulo,
    subcapitulo: opts.subcapitulo,
    descripcion: opts.descripcion,
    estimado_usd: opts.estimado,
    estimado_proyectado_usd: estimadoProj,
    ejecutado_usd: opts.ejecutado,
    saldo_usd: saldo,
    pct_ejecutado: pct,
    area_m2: area,
    es_modulo: esCapituloModulo(opts.capitulo),
    ejecutado_usd_m2: area > 0 ? Math.round((opts.ejecutado / area) * 100) / 100 : null,
    estimado_usd_m2: area > 0 ? Math.round((estimadoProj / area) * 100) / 100 : null,
  };
}

function m2(total: number, area: number): number | null {
  if (area <= 0) return null;
  return Math.round((total / area) * 100) / 100;
}

/**
 * Presupuestos por capítulo + ejecutado desde compras con mismo capitulo_cco.
 */
export async function cargarPresupuestosCco(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CcoPresupuestosResumen> {
  let selectCols = 'id,capitulo,subcapitulo,descripcion,estimado_usd,area_m2';
  let { data: presup, error } = await supabase
    .from('cco_presupuestos_capitulo')
    .select(selectCols)
    .eq('proyecto_id', proyectoId)
    .order('capitulo')
    .order('subcapitulo');

  // Fallback si aún no corrió la migración 278 (sin area_m2).
  if (error && /area_m2|schema cache|42703/i.test(error.message ?? '')) {
    selectCols = 'id,capitulo,subcapitulo,descripcion,estimado_usd';
    const retry = await supabase
      .from('cco_presupuestos_capitulo')
      .select(selectCols)
      .eq('proyecto_id', proyectoId)
      .order('capitulo')
      .order('subcapitulo');
    presup = retry.data;
    error = retry.error;
  }
  if (error) throw error;

  const { data: compras, error: cErr } = await supabase
    .from('contabilidad_compras')
    .select('capitulo_cco,monto_usd')
    .eq('proyecto_id', proyectoId)
    .not('capitulo_cco', 'is', null)
    .limit(8000);
  if (cErr && !/capitulo_cco|schema cache/i.test(cErr.message ?? '')) throw cErr;

  const ejecutadoPorCap = new Map<string, number>();
  for (const row of compras ?? []) {
    const cap = String((row as { capitulo_cco?: string }).capitulo_cco ?? '')
      .trim()
      .toUpperCase();
    if (!cap) continue;
    ejecutadoPorCap.set(
      cap,
      (ejecutadoPorCap.get(cap) ?? 0) + num((row as { monto_usd?: number }).monto_usd),
    );
  }

  const filas: CcoPresupuestoFila[] = (presup ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown>;
    const capitulo = String(r.capitulo ?? '').trim() || 'SIN CAPÍTULO';
    return buildFila({
      id: String(r.id),
      capitulo,
      subcapitulo: r.subcapitulo != null ? String(r.subcapitulo) : null,
      descripcion: r.descripcion != null ? String(r.descripcion) : null,
      estimado: num(r.estimado_usd),
      ejecutado: ejecutadoPorCap.get(capitulo.toUpperCase()) ?? 0,
      area_m2: num(r.area_m2),
    });
  });

  // Capítulos con gasto pero sin fila presupuesto
  const capsPresup = new Set(filas.map((f) => f.capitulo.toUpperCase()));
  for (const [cap, usd] of Array.from(ejecutadoPorCap.entries())) {
    if (capsPresup.has(cap)) continue;
    filas.push(
      buildFila({
        id: `exec-${cap}`,
        capitulo: cap,
        subcapitulo: null,
        descripcion: 'Solo ejecutado (sin presupuesto V4)',
        estimado: 0,
        ejecutado: usd,
        area_m2: 0,
      }),
    );
  }

  filas.sort((a, b) => a.capitulo.localeCompare(b.capitulo, 'es'));

  const totalEstimado = filas.reduce((a, f) => a + f.estimado_proyectado_usd, 0);
  const totalEjecutado = filas.reduce((a, f) => a + f.ejecutado_usd, 0);
  const totalSaldo = totalEstimado - totalEjecutado;
  const avancePct =
    totalEstimado > 0
      ? Math.min(999, Math.round((totalEjecutado / totalEstimado) * 10000) / 100)
      : 0;

  const areaTotalM2 = filas.reduce((a, f) => a + f.area_m2, 0);
  const areaModulosM2 = filas.filter((f) => f.es_modulo).reduce((a, f) => a + f.area_m2, 0);

  let modulosEjecutado = 0;
  let modulosEstimado = 0;
  let obrasEjecutado = 0;
  let obrasEstimado = 0;
  for (const f of filas) {
    if (f.es_modulo) {
      modulosEjecutado += f.ejecutado_usd;
      modulosEstimado += f.estimado_proyectado_usd;
    } else {
      obrasEjecutado += f.ejecutado_usd;
      obrasEstimado += f.estimado_proyectado_usd;
    }
  }

  const baseM2 = areaModulosM2 > 0 ? areaModulosM2 : areaTotalM2;
  const modulosRestante = modulosEstimado - modulosEjecutado;
  const obrasRestante = obrasEstimado - obrasEjecutado;
  const totalRestante = totalSaldo;

  return {
    filas,
    totalEstimado,
    totalEjecutado,
    totalSaldo,
    avancePct,
    areaTotalM2,
    areaModulosM2,
    costoRealM2: m2(totalEjecutado, areaTotalM2),
    costoProyectadoM2: m2(totalEstimado, areaTotalM2),
    analisisM2: {
      modulosEjecutado,
      modulosEstimado,
      obrasEjecutado,
      obrasEstimado,
      modulosEjecutadoM2: m2(modulosEjecutado, baseM2),
      modulosEstimadoM2: m2(modulosEstimado, baseM2),
      obrasEjecutadoM2: m2(obrasEjecutado, baseM2),
      obrasEstimadoM2: m2(obrasEstimado, baseM2),
      modulosRestanteM2: m2(modulosRestante, baseM2),
      obrasRestanteM2: m2(obrasRestante, baseM2),
      totalRestanteM2: m2(totalRestante, baseM2),
      costoTotalRealM2: m2(totalEjecutado, baseM2),
      costoTotalProyectadoM2: m2(totalEstimado, baseM2),
    },
  };
}
