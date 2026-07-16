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

export type CcoPresupuestosResumen = {
  filas: CcoPresupuestoFila[];
  totalEstimado: number;
  totalEjecutado: number;
  totalSaldo: number;
};

/**
 * Presupuestos por capítulo + ejecutado desde compras con mismo capitulo_cco.
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

  // Capítulos con gasto pero sin fila presupuesto
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

  const totalEstimado = filas.reduce((a, f) => a + f.estimado_usd, 0);
  const totalEjecutado = filas.reduce((a, f) => a + f.ejecutado_usd, 0);

  return {
    filas,
    totalEstimado,
    totalEjecutado,
    totalSaldo: totalEstimado - totalEjecutado,
  };
}
