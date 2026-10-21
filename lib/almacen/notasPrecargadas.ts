import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Notas de entrega precargadas por el comprador (foto → IA).
 * Quedan 'pendiente' hasta que el depositario de la obra las ingresa al almacén.
 * Nada de esto toca stock: el ingreso ocurre solo en la RPC de recepción de campo.
 */

export type LineaPrecarga = {
  descripcion: string;
  cantidad: number;
  unidad: string;
  material_id: string | null;
  material_nombre: string | null;
  item_code: string | null;
};

export type NotaPrecargada = {
  id: string;
  proyecto_id: string;
  proveedor_nombre: string;
  proveedor_rif: string | null;
  num_doc: string;
  fecha: string | null;
  lineas: LineaPrecarga[];
  soporte_storage_path: string | null;
  soporte_file_name: string | null;
  soporte_mime_type: string | null;
  estado: 'pendiente' | 'ingresada' | 'anulada';
  cargado_por_label: string | null;
  created_at: string;
};

export type NuevaNotaPrecargada = Omit<NotaPrecargada, 'id' | 'estado' | 'created_at'> & {
  cargado_por_chat_id?: string | null;
};

/** Pura: separa las líneas que ya tienen material del catálogo de las que no. */
export function separarLineasPrecarga(lineas: LineaPrecarga[]): {
  conMaterial: LineaPrecarga[];
  sinMaterial: LineaPrecarga[];
} {
  const conMaterial: LineaPrecarga[] = [];
  const sinMaterial: LineaPrecarga[] = [];
  for (const l of lineas) {
    if (!(Number(l.cantidad) > 0)) continue;
    if (l.material_id?.trim()) conMaterial.push(l);
    else sinMaterial.push(l);
  }
  return { conMaterial, sinMaterial };
}

function aNota(row: Record<string, unknown>): NotaPrecargada {
  return {
    id: String(row.id),
    proyecto_id: String(row.proyecto_id),
    proveedor_nombre: String(row.proveedor_nombre ?? ''),
    proveedor_rif: (row.proveedor_rif as string | null) ?? null,
    num_doc: String(row.num_doc ?? 'S/N'),
    fecha: (row.fecha as string | null) ?? null,
    lineas: Array.isArray(row.lineas) ? (row.lineas as LineaPrecarga[]) : [],
    soporte_storage_path: (row.soporte_storage_path as string | null) ?? null,
    soporte_file_name: (row.soporte_file_name as string | null) ?? null,
    soporte_mime_type: (row.soporte_mime_type as string | null) ?? null,
    estado: row.estado as NotaPrecargada['estado'],
    cargado_por_label: (row.cargado_por_label as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

export async function crearNotaPrecargada(
  supabase: SupabaseClient,
  nota: NuevaNotaPrecargada,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('ci_notas_precargadas')
    .insert({
      proyecto_id: nota.proyecto_id,
      proveedor_nombre: nota.proveedor_nombre,
      proveedor_rif: nota.proveedor_rif,
      num_doc: nota.num_doc,
      fecha: nota.fecha,
      lineas: nota.lineas,
      soporte_storage_path: nota.soporte_storage_path,
      soporte_file_name: nota.soporte_file_name,
      soporte_mime_type: nota.soporte_mime_type,
      cargado_por_chat_id: nota.cargado_por_chat_id ?? null,
      cargado_por_label: nota.cargado_por_label,
    })
    .select('id')
    .single();
  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? 'No se pudo guardar la nota precargada' };
  }
  return { ok: true, id: String(data.id) };
}

export async function listarNotasPrecargadasPendientes(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<NotaPrecargada[]> {
  const { data, error } = await supabase
    .from('ci_notas_precargadas')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => aNota(r));
}

export async function obtenerNotaPrecargada(
  supabase: SupabaseClient,
  id: string,
): Promise<NotaPrecargada | null> {
  const { data, error } = await supabase
    .from('ci_notas_precargadas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? aNota(data as Record<string, unknown>) : null;
}

/** Solo marca como ingresada una nota que siga pendiente (idempotente). */
export async function marcarNotaPrecargadaIngresada(
  supabase: SupabaseClient,
  id: string,
  recepcionId: string,
): Promise<void> {
  const ahora = new Date().toISOString();
  await supabase
    .from('ci_notas_precargadas')
    .update({ estado: 'ingresada', recepcion_id: recepcionId, ingresada_at: ahora, updated_at: ahora })
    .eq('id', id)
    .eq('estado', 'pendiente');
}
