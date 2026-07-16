import type { SupabaseClient } from '@supabase/supabase-js';

export type CcoProyectoConfig = {
  proyecto_id: string;
  honorarios_admin_pct: number;
  devaluacion_pct: number;
  empresa_nombre: string | null;
  obra_alias: string | null;
  area_m2: number | null;
  fuente_honorarios: 'cco' | 'ad' | 'default';
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Lee config CCO; si no hay fila, arma defaults (opcionalmente desde AD). */
export async function obtenerConfigCco(
  supabase: SupabaseClient,
  proyectoId: string,
  opts?: { honorariosAdFallback?: number | null },
): Promise<CcoProyectoConfig> {
  const { data, error } = await supabase
    .from('cco_proyecto_config')
    .select(
      'proyecto_id,honorarios_admin_pct,devaluacion_pct,empresa_nombre,obra_alias,area_m2',
    )
    .eq('proyecto_id', proyectoId)
    .maybeSingle();

  if (error && !/cco_proyecto_config|schema cache|42703/i.test(error.message ?? '')) {
    throw error;
  }

  if (data) {
    const r = data as Record<string, unknown>;
    return {
      proyecto_id: proyectoId,
      honorarios_admin_pct: num(r.honorarios_admin_pct, 15),
      devaluacion_pct: num(r.devaluacion_pct, 0),
      empresa_nombre: r.empresa_nombre != null ? String(r.empresa_nombre) : null,
      obra_alias: r.obra_alias != null ? String(r.obra_alias) : null,
      area_m2: r.area_m2 != null ? num(r.area_m2) : null,
      fuente_honorarios: 'cco',
    };
  }

  const ad = opts?.honorariosAdFallback;
  if (ad != null && Number.isFinite(ad) && ad > 0) {
    return {
      proyecto_id: proyectoId,
      honorarios_admin_pct: Number(ad),
      devaluacion_pct: 0,
      empresa_nombre: null,
      obra_alias: null,
      area_m2: null,
      fuente_honorarios: 'ad',
    };
  }

  return {
    proyecto_id: proyectoId,
    honorarios_admin_pct: 15,
    devaluacion_pct: 0,
    empresa_nombre: null,
    obra_alias: null,
    area_m2: null,
    fuente_honorarios: 'default',
  };
}

export async function guardarConfigCco(
  supabase: SupabaseClient,
  input: {
    proyecto_id: string;
    honorarios_admin_pct: number;
    devaluacion_pct: number;
    empresa_nombre?: string | null;
    obra_alias?: string | null;
    area_m2?: number | null;
    actor?: string | null;
  },
): Promise<CcoProyectoConfig> {
  const honorarios = Math.min(100, Math.max(0, num(input.honorarios_admin_pct, 15)));
  const devaluacion = Math.max(0, num(input.devaluacion_pct, 0));

  const { error } = await supabase.from('cco_proyecto_config').upsert(
    {
      proyecto_id: input.proyecto_id,
      honorarios_admin_pct: honorarios,
      devaluacion_pct: devaluacion,
      empresa_nombre: input.empresa_nombre?.trim() || null,
      obra_alias: input.obra_alias?.trim() || null,
      area_m2: input.area_m2 != null && Number.isFinite(input.area_m2) ? input.area_m2 : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'proyecto_id' },
  );
  if (error) throw error;

  await supabase.from('cco_auditoria_eventos').insert({
    proyecto_id: input.proyecto_id,
    accion: 'AJUSTES CCO',
    detalle: `% admin ${honorarios} · devaluación ${devaluacion}%`,
    actor: input.actor ?? 'cco_ajustes',
    metadata: {
      honorarios_admin_pct: honorarios,
      devaluacion_pct: devaluacion,
      obra_alias: input.obra_alias ?? null,
    },
  });

  return {
    proyecto_id: input.proyecto_id,
    honorarios_admin_pct: honorarios,
    devaluacion_pct: devaluacion,
    empresa_nombre: input.empresa_nombre?.trim() || null,
    obra_alias: input.obra_alias?.trim() || null,
    area_m2: input.area_m2 ?? null,
    fuente_honorarios: 'cco',
  };
}
