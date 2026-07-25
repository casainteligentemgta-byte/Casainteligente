import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MetronAnalisisResultado,
  MetronAnalisisRow,
  MetronComputoRow,
  MetronDisciplina,
} from '@/types/metron';

export type PersistirMetronInput = {
  proyectoId: string;
  planoArchivoId?: string | null;
  archivoNombre?: string;
  mimeType?: string;
  publicUrl?: string | null;
  modelo?: string | null;
  resultado: MetronAnalisisResultado;
  status?: 'borrador' | 'error';
  errorMensaje?: string | null;
};

function mapAnalisisRow(raw: Record<string, unknown>, computos?: MetronComputoRow[]): MetronAnalisisRow {
  return {
    id: String(raw.id),
    proyecto_id: String(raw.proyecto_id),
    plano_archivo_id: (raw.plano_archivo_id as string) || null,
    disciplina: (raw.disciplina as MetronDisciplina) || 'desconocida',
    especialidades: Array.isArray(raw.especialidades)
      ? (raw.especialidades as MetronDisciplina[])
      : [],
    titulo_plano: String(raw.titulo_plano ?? ''),
    escala_detectada: String(raw.escala_detectada ?? ''),
    resumen: String(raw.resumen ?? ''),
    supuestos: Array.isArray(raw.supuestos) ? (raw.supuestos as string[]) : [],
    alertas: Array.isArray(raw.alertas) ? (raw.alertas as string[]) : [],
    status: (raw.status as MetronAnalisisRow['status']) || 'borrador',
    modelo: (raw.modelo as string) || null,
    archivo_nombre: String(raw.archivo_nombre ?? ''),
    mime_type: String(raw.mime_type ?? ''),
    public_url: (raw.public_url as string) || null,
    error_mensaje: (raw.error_mensaje as string) || null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
    computos,
  };
}

export async function persistirAnalisisMetron(
  supabase: SupabaseClient,
  input: PersistirMetronInput,
): Promise<MetronAnalisisRow> {
  const now = new Date().toISOString();
  const { resultado } = input;

  const { data: analisis, error } = await supabase
    .from('ci_metron_analisis')
    .insert({
      proyecto_id: input.proyectoId,
      plano_archivo_id: input.planoArchivoId ?? null,
      disciplina: resultado.disciplina,
      especialidades: resultado.especialidades,
      titulo_plano: resultado.titulo_plano,
      escala_detectada: resultado.escala_detectada,
      resumen: resultado.resumen,
      supuestos: resultado.supuestos,
      alertas: resultado.alertas,
      status: input.status ?? 'borrador',
      modelo: input.modelo ?? null,
      archivo_nombre: input.archivoNombre ?? '',
      mime_type: input.mimeType ?? '',
      public_url: input.publicUrl ?? null,
      raw_json: resultado,
      error_mensaje: input.errorMensaje ?? null,
      updated_at: now,
    } as never)
    .select('*')
    .single();

  if (error || !analisis) {
    throw new Error(error?.message || 'No se pudo guardar el análisis Metron.');
  }

  const analisisId = String(analisis.id);
  const filas = resultado.computos.map((c, orden) => ({
    analisis_id: analisisId,
    orden,
    codigo_sugerido: c.codigo_sugerido,
    descripcion: c.descripcion,
    unidad: c.unidad,
    cantidad: c.cantidad,
    precio_unitario_estimado: c.precio_unitario_estimado,
    monto_estimado: c.monto_estimado,
    capitulo_sugerido: c.capitulo_sugerido,
    supuesto: c.supuesto,
    confianza: c.confianza,
    disciplina: c.disciplina,
    aprobado: true,
  }));

  let computos: MetronComputoRow[] = [];
  if (filas.length > 0) {
    const { data: comps, error: cErr } = await supabase
      .from('ci_metron_computos')
      .insert(filas as never)
      .select('*')
      .order('orden', { ascending: true });

    if (cErr) {
      throw new Error(cErr.message || 'No se pudieron guardar los cómputos Metron.');
    }
    computos = ((comps ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      analisis_id: String(r.analisis_id),
      orden: Number(r.orden ?? 0),
      codigo_sugerido: String(r.codigo_sugerido ?? ''),
      descripcion: String(r.descripcion ?? ''),
      unidad: String(r.unidad ?? 'UND'),
      cantidad: Number(r.cantidad ?? 0),
      precio_unitario_estimado: Number(r.precio_unitario_estimado ?? 0),
      monto_estimado: Number(r.monto_estimado ?? 0),
      capitulo_sugerido: String(r.capitulo_sugerido ?? ''),
      supuesto: String(r.supuesto ?? ''),
      confianza: Number(r.confianza ?? 0),
      disciplina: (r.disciplina as MetronDisciplina) || 'arq',
      aprobado: Boolean(r.aprobado),
      partida_id: (r.partida_id as string) || null,
      created_at: r.created_at ? String(r.created_at) : undefined,
    }));
  }

  return mapAnalisisRow(analisis as Record<string, unknown>, computos);
}

export async function cargarAnalisisMetron(
  supabase: SupabaseClient,
  analisisId: string,
): Promise<MetronAnalisisRow | null> {
  const { data: analisis, error } = await supabase
    .from('ci_metron_analisis')
    .select('*')
    .eq('id', analisisId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!analisis) return null;

  const { data: comps, error: cErr } = await supabase
    .from('ci_metron_computos')
    .select('*')
    .eq('analisis_id', analisisId)
    .order('orden', { ascending: true });

  if (cErr) throw new Error(cErr.message);

  const computos: MetronComputoRow[] = ((comps ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    analisis_id: String(r.analisis_id),
    orden: Number(r.orden ?? 0),
    codigo_sugerido: String(r.codigo_sugerido ?? ''),
    descripcion: String(r.descripcion ?? ''),
    unidad: String(r.unidad ?? 'UND'),
    cantidad: Number(r.cantidad ?? 0),
    precio_unitario_estimado: Number(r.precio_unitario_estimado ?? 0),
    monto_estimado: Number(r.monto_estimado ?? 0),
    capitulo_sugerido: String(r.capitulo_sugerido ?? ''),
    supuesto: String(r.supuesto ?? ''),
    confianza: Number(r.confianza ?? 0),
    disciplina: (r.disciplina as MetronDisciplina) || 'arq',
    aprobado: Boolean(r.aprobado),
    partida_id: (r.partida_id as string) || null,
    created_at: r.created_at ? String(r.created_at) : undefined,
  }));

  return mapAnalisisRow(analisis as Record<string, unknown>, computos);
}

export async function listarAnalisisMetronPorProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  limit = 20,
): Promise<MetronAnalisisRow[]> {
  const { data, error } = await supabase
    .from('ci_metron_analisis')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => mapAnalisisRow(r));
}
