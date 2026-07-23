import type { SupabaseClient } from '@supabase/supabase-js';

export type CcoProyectoConfig = {
  proyecto_id: string;
  honorarios_admin_pct: number;
  devaluacion_pct: number;
  empresa_nombre: string | null;
  obra_alias: string | null;
  area_m2: number | null;
  fuente_honorarios: 'cco' | 'ad' | 'default';
  /** Nombre del último CSV diario importado (libro visualizado). */
  csv_nombre: string | null;
  csv_importado_at: string | null;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function metaCsv(meta: unknown): { csv_nombre: string | null; csv_importado_at: string | null } {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { csv_nombre: null, csv_importado_at: null };
  }
  const m = meta as Record<string, unknown>;
  const nombre = m.csv_nombre != null ? String(m.csv_nombre).trim() : '';
  const at = m.csv_importado_at != null ? String(m.csv_importado_at).trim() : '';
  return {
    csv_nombre: nombre || null,
    csv_importado_at: at || null,
  };
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
      'proyecto_id,honorarios_admin_pct,devaluacion_pct,empresa_nombre,obra_alias,area_m2,metadata',
    )
    .eq('proyecto_id', proyectoId)
    .maybeSingle();

  if (error && !/cco_proyecto_config|schema cache|42703/i.test(error.message ?? '')) {
    throw error;
  }

  if (data) {
    const r = data as Record<string, unknown>;
    const csv = metaCsv(r.metadata);
    return {
      proyecto_id: proyectoId,
      honorarios_admin_pct: num(r.honorarios_admin_pct, 15),
      devaluacion_pct: num(r.devaluacion_pct, 0),
      empresa_nombre: r.empresa_nombre != null ? String(r.empresa_nombre) : null,
      obra_alias: r.obra_alias != null ? String(r.obra_alias) : null,
      area_m2: r.area_m2 != null ? num(r.area_m2) : null,
      fuente_honorarios: 'cco',
      csv_nombre: csv.csv_nombre,
      csv_importado_at: csv.csv_importado_at,
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
      csv_nombre: null,
      csv_importado_at: null,
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
    csv_nombre: null,
    csv_importado_at: null,
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
  // Acepta +% (UI: real = oficial/(1+d/100)) y −% (Python: real = oficial*(1+d/100)).
  const devaluacionRaw = num(input.devaluacion_pct, 0);
  const devaluacion = Math.min(500, Math.max(-99.99, devaluacionRaw));

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

  return obtenerConfigCco(supabase, input.proyecto_id);
}

/** Guarda el nombre del CSV diario que alimenta el libro de la obra. */
export async function guardarCsvFuenteCco(
  supabase: SupabaseClient,
  proyectoId: string,
  csvNombre: string,
): Promise<{ csv_nombre: string; csv_importado_at: string }> {
  const pid = String(proyectoId ?? '').trim();
  const nombre = String(csvNombre ?? '').trim();
  if (!pid) throw new Error('proyecto_id requerido.');
  if (!nombre) throw new Error('csv_nombre requerido.');

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('cco_proyecto_config')
    .select('metadata')
    .eq('proyecto_id', pid)
    .maybeSingle();

  const prevRaw = (existing as { metadata?: unknown } | null)?.metadata;
  const prevMeta =
    prevRaw && typeof prevRaw === 'object' && !Array.isArray(prevRaw)
      ? { ...(prevRaw as Record<string, unknown>) }
      : {};

  const metadata = {
    ...prevMeta,
    csv_nombre: nombre,
    csv_importado_at: now,
  };

  const { error } = await supabase.from('cco_proyecto_config').upsert(
    {
      proyecto_id: pid,
      metadata,
      updated_at: now,
    } as never,
    { onConflict: 'proyecto_id' },
  );
  if (error) throw error;

  return { csv_nombre: nombre, csv_importado_at: now };
}
