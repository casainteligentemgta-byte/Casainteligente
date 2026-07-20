import type { SupabaseClient } from '@supabase/supabase-js';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type CcoPresupuestoFila = {
  id: string;
  capitulo: string;
  subcapitulo: string | null;
  descripcion: string | null;
  estimado_usd: number;
  ejecutado_usd: number;
  saldo_usd: number;
  pct_ejecutado: number;
};

/** Fila agregada por capítulo (vista V4 / Streamlit). */
export type CcoPresupuestoCapituloAgg = {
  capitulo: string;
  estimado_usd: number;
  ejecutado_usd: number;
  /** Margen positivo (estimado − ejecutado) o 0 si hay exceso. */
  restante_usd: number;
  /** Desviación cuando ejecutado > estimado. */
  exceso_usd: number;
  pct_ejecutado: number;
};

export type CcoPresupuestosResumen = {
  filas: CcoPresupuestoFila[];
  porCapitulo: CcoPresupuestoCapituloAgg[];
  totalEstimado: number;
  totalEjecutado: number;
  totalSaldo: number;
  avancePct: number;
  areaM2: number | null;
  costoRealM2: number | null;
  costoProyectadoM2: number | null;
};

/**
 * Presupuestos por capítulo + ejecutado desde compras con mismo capitulo_cco.
 * Incluye agregados y KPIs m² (área en cco_proyecto_config) como en CCO V4.
 */
export async function cargarPresupuestosCco(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CcoPresupuestosResumen> {
  const { data: presup, error } = await supabase
    .from('cco_presupuestos_capitulo')
    .select('id,capitulo,subcapitulo,descripcion,estimado_usd')
    .eq('proyecto_id', proyectoId)
    .order('capitulo')
    .order('subcapitulo');
  if (error) throw error;

  const { data: cfg } = await supabase
    .from('cco_proyecto_config')
    .select('area_m2')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();

  const areaM2Raw = cfg && (cfg as { area_m2?: number | null }).area_m2;
  const areaM2 = areaM2Raw != null && Number(areaM2Raw) > 0 ? num(areaM2Raw) : null;

  const { data: compras, error: cErr } = await supabase
    .from('contabilidad_compras')
    .select('capitulo_cco,monto_usd,honorarios_usd')
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
    const base = num((row as { monto_usd?: number }).monto_usd);
    const hon = num((row as { honorarios_usd?: number | null }).honorarios_usd);
    ejecutadoPorCap.set(cap, (ejecutadoPorCap.get(cap) ?? 0) + base + hon);
  }

  const filas: CcoPresupuestoFila[] = (presup ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const capitulo = String(r.capitulo ?? '').trim() || 'SIN CAPÍTULO';
    const estimado = num(r.estimado_usd);
    const ejecutado = ejecutadoPorCap.get(capitulo.toUpperCase()) ?? 0;
    const saldo = estimado - ejecutado;
    return {
      id: String(r.id),
      capitulo,
      subcapitulo: r.subcapitulo != null ? String(r.subcapitulo) : null,
      descripcion: r.descripcion != null ? String(r.descripcion) : null,
      estimado_usd: estimado,
      ejecutado_usd: ejecutado,
      saldo_usd: saldo,
      pct_ejecutado:
        estimado > 0 ? Math.min(999, Math.round((ejecutado / estimado) * 1000) / 10) : 0,
    };
  });

  const capsPresup = new Set(filas.map((f) => f.capitulo.toUpperCase()));
  for (const [cap, usd] of Array.from(ejecutadoPorCap.entries())) {
    if (capsPresup.has(cap)) continue;
    filas.push({
      id: `exec-${cap}`,
      capitulo: cap,
      subcapitulo: null,
      descripcion: 'Solo ejecutado (sin presupuesto V4)',
      estimado_usd: 0,
      ejecutado_usd: usd,
      saldo_usd: -usd,
      pct_ejecutado: 0,
    });
  }

  filas.sort((a, b) => a.capitulo.localeCompare(b.capitulo, 'es'));

  // Agregar por capítulo (varias filas sub → una barra en el gráfico V4).
  // Ejecutado viene por capítulo completo; no duplicar si hay varios subcapítulos.
  const aggMap = new Map<string, { estimado: number; ejecutado: number; label: string }>();
  for (const f of filas) {
    const k = f.capitulo.toUpperCase();
    const cur = aggMap.get(k);
    if (!cur) {
      aggMap.set(k, {
        estimado: f.estimado_usd,
        ejecutado: f.ejecutado_usd,
        label: f.capitulo,
      });
    } else {
      cur.estimado += f.estimado_usd;
    }
  }

  const porCapitulo: CcoPresupuestoCapituloAgg[] = Array.from(aggMap.values())
    .map((v) => {
      const restante = Math.max(0, v.estimado - v.ejecutado);
      const exceso = Math.max(0, v.ejecutado - v.estimado);
      return {
        capitulo: v.label,
        estimado_usd: v.estimado,
        ejecutado_usd: v.ejecutado,
        restante_usd: restante,
        exceso_usd: exceso,
        pct_ejecutado:
          v.estimado > 0 ? Math.min(999, Math.round((v.ejecutado / v.estimado) * 1000) / 10) : 0,
      };
    })
    .sort((a, b) => b.estimado_usd - a.estimado_usd);

  const totalEstimado = porCapitulo.reduce((a, f) => a + f.estimado_usd, 0);
  const totalEjecutado = porCapitulo.reduce((a, f) => a + f.ejecutado_usd, 0);
  const totalSaldo = totalEstimado - totalEjecutado;
  const avancePct =
    totalEstimado > 0 ? Math.round((totalEjecutado / totalEstimado) * 10000) / 100 : 0;

  return {
    filas,
    porCapitulo,
    totalEstimado,
    totalEjecutado,
    totalSaldo,
    avancePct,
    areaM2,
    costoRealM2: areaM2 ? Math.round((totalEjecutado / areaM2) * 100) / 100 : null,
    costoProyectadoM2: areaM2 ? Math.round((totalEstimado / areaM2) * 100) / 100 : null,
  };
}
