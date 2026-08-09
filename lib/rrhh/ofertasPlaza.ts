import type { SupabaseClient } from '@supabase/supabase-js';

export type OfertaPlazaEstado =
  | 'pendiente'
  | 'aceptada'
  | 'rechazada'
  | 'caducada'
  | 'asignada';

export type OfertaPlazaRow = {
  id: string;
  created_at: string;
  updated_at: string;
  empleado_id: string;
  labor_request_id: string | null;
  proyecto_id: string | null;
  entidad_id: string | null;
  oficio_codigo: string | null;
  oficio_nombre: string;
  estado: OfertaPlazaEstado;
  canal: string;
  mensaje_enviado_at: string | null;
  respondido_at: string | null;
  notas: string | null;
};

export type CrearOfertaPlazaInput = {
  empleadoId: string;
  oficioNombre: string;
  oficioCodigo?: string | null;
  proyectoId?: string | null;
  entidadId?: string | null;
  laborRequestId?: string | null;
  canal?: string;
  notas?: string | null;
  marcarMensajeEnviado?: boolean;
};

export async function crearOfertaPlaza(
  supabase: SupabaseClient,
  input: CrearOfertaPlazaInput,
): Promise<{ ok: true; oferta: OfertaPlazaRow } | { ok: false; error: string }> {
  const empleadoId = input.empleadoId.trim();
  const oficioNombre = input.oficioNombre.trim();
  if (!empleadoId) return { ok: false, error: 'empleado_id requerido' };
  if (!oficioNombre) return { ok: false, error: 'oficio_nombre requerido' };

  const now = new Date().toISOString();
  const payload = {
    empleado_id: empleadoId,
    oficio_nombre: oficioNombre,
    oficio_codigo: (input.oficioCodigo ?? '').trim() || null,
    proyecto_id: (input.proyectoId ?? '').trim() || null,
    entidad_id: (input.entidadId ?? '').trim() || null,
    labor_request_id: (input.laborRequestId ?? '').trim() || null,
    estado: 'pendiente' as const,
    canal: (input.canal ?? 'whatsapp').trim() || 'whatsapp',
    notas: (input.notas ?? '').trim() || null,
    mensaje_enviado_at: input.marcarMensajeEnviado === false ? null : now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('ci_ofertas_plaza')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'No se pudo crear la oferta' };
  }
  return { ok: true, oferta: data as OfertaPlazaRow };
}

export async function responderOfertaPlaza(
  supabase: SupabaseClient,
  ofertaId: string,
  estado: 'aceptada' | 'rechazada' | 'caducada' | 'asignada',
  notas?: string | null,
): Promise<{ ok: true; oferta: OfertaPlazaRow } | { ok: false; error: string }> {
  const id = ofertaId.trim();
  if (!id) return { ok: false, error: 'id requerido' };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    estado,
    respondido_at: now,
    updated_at: now,
  };
  if (notas != null) patch.notas = notas.trim() || null;

  const { data, error } = await supabase
    .from('ci_ofertas_plaza')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'No se pudo actualizar la oferta' };
  }

  // Disponibilidad del empleado según respuesta.
  const empId = (data as OfertaPlazaRow).empleado_id;
  if (estado === 'aceptada' || estado === 'asignada') {
    await supabase.from('ci_empleados').update({ estatus: 'asignado' }).eq('id', empId);
  } else if (estado === 'rechazada') {
    await supabase.from('ci_empleados').update({ estatus: 'no_disponible' }).eq('id', empId);
  }

  return { ok: true, oferta: data as OfertaPlazaRow };
}

export async function ofertaPendienteDeEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<OfertaPlazaRow | null> {
  const { data } = await supabase
    .from('ci_ofertas_plaza')
    .select('*')
    .eq('empleado_id', empleadoId.trim())
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OfertaPlazaRow | null) ?? null;
}

export async function mapaOfertasActivasPorEmpleado(
  supabase: SupabaseClient,
  empleadoIds: string[],
): Promise<Map<string, OfertaPlazaRow>> {
  const ids = Array.from(new Set(empleadoIds.map((x) => x.trim()).filter(Boolean)));
  const map = new Map<string, OfertaPlazaRow>();
  if (!ids.length) return map;

  const { data } = await supabase
    .from('ci_ofertas_plaza')
    .select('*')
    .in('empleado_id', ids)
    .in('estado', ['pendiente', 'aceptada'])
    .order('created_at', { ascending: false })
    .limit(500);

  for (const row of (data ?? []) as OfertaPlazaRow[]) {
    if (!map.has(row.empleado_id)) map.set(row.empleado_id, row);
  }
  return map;
}
