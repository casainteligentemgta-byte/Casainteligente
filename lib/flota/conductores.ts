import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TIPOS_DOCUMENTO_CONDUCTOR,
  TIPOS_LICENCIA,
  esMigracionPendiente,
  esUuid,
  parseFechaIso,
  type FlotaVehiculo,
} from '@/lib/flota/utils';

export type FlotaConductorDocumento = {
  id: string;
  conductor_id: string;
  tipo: (typeof TIPOS_DOCUMENTO_CONDUCTOR)[number];
  nombre: string;
  url: string | null;
  vence_el: string | null;
  created_at: string;
};

export type FlotaConductor = {
  id: string;
  empleado_id: string | null;
  entidad_id: string | null;
  proyecto_id: string | null;
  vehiculo_asignado_id: string | null;
  nombres: string;
  apellidos: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  tipo_licencia: string | null;
  licencia_numero: string | null;
  licencia_vence: string | null;
  certificado_medico_vence: string | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
  vehiculo?: Pick<FlotaVehiculo, 'id' | 'placa' | 'marca' | 'modelo'> | null;
  documentos?: FlotaConductorDocumento[];
};

const CONDUCTOR_SELECT =
  'id, empleado_id, entidad_id, proyecto_id, vehiculo_asignado_id, nombres, apellidos, cedula, telefono, email, tipo_licencia, licencia_numero, licencia_vence, certificado_medico_vence, activo, notas, created_at, updated_at';

const CONDUCTOR_LIST_SELECT = `${CONDUCTOR_SELECT}, vehiculo:ci_flota_vehiculos!vehiculo_asignado_id (id, placa, marca, modelo)`;

function unwrapVehiculo(row: Record<string, unknown>): FlotaConductor {
  const raw = row.vehiculo;
  const vehiculo = Array.isArray(raw) ? raw[0] : raw;
  return { ...(row as unknown as FlotaConductor), vehiculo: vehiculo ?? null };
}

function payloadConductor(body: Record<string, unknown>, partial = false): Record<string, unknown> {
  const nombres = String(body.nombres ?? '').trim();
  const apellidos = String(body.apellidos ?? '').trim();
  if (!partial && !nombres) throw new Error('nombres requerido');
  if (!partial && !apellidos) throw new Error('apellidos requerido');

  const tipoLic = body.tipo_licencia != null ? String(body.tipo_licencia).trim() : '';
  const tipoOk = (TIPOS_LICENCIA as readonly string[]).includes(tipoLic) ? tipoLic : tipoLic || null;

  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!partial || body.nombres !== undefined) out.nombres = nombres;
  if (!partial || body.apellidos !== undefined) out.apellidos = apellidos;
  if (!partial || body.cedula !== undefined) out.cedula = String(body.cedula ?? '').trim() || null;
  if (!partial || body.telefono !== undefined) out.telefono = String(body.telefono ?? '').trim() || null;
  if (!partial || body.email !== undefined) out.email = String(body.email ?? '').trim() || null;
  if (!partial || body.tipo_licencia !== undefined) out.tipo_licencia = tipoOk;
  if (!partial || body.licencia_numero !== undefined) {
    out.licencia_numero = String(body.licencia_numero ?? '').trim() || null;
  }
  if (!partial || body.licencia_vence !== undefined) {
    out.licencia_vence = parseFechaIso(body.licencia_vence);
  }
  if (!partial || body.certificado_medico_vence !== undefined) {
    out.certificado_medico_vence = parseFechaIso(body.certificado_medico_vence);
  }
  if (!partial || body.vehiculo_asignado_id !== undefined) {
    out.vehiculo_asignado_id = esUuid(String(body.vehiculo_asignado_id ?? ''))
      ? String(body.vehiculo_asignado_id)
      : null;
  }
  if (!partial || body.entidad_id !== undefined) {
    out.entidad_id = esUuid(String(body.entidad_id ?? '')) ? String(body.entidad_id) : null;
  }
  if (!partial || body.proyecto_id !== undefined) {
    out.proyecto_id = esUuid(String(body.proyecto_id ?? '')) ? String(body.proyecto_id) : null;
  }
  if (!partial || body.empleado_id !== undefined) {
    out.empleado_id = esUuid(String(body.empleado_id ?? '')) ? String(body.empleado_id) : null;
  }
  if (!partial || body.activo !== undefined) out.activo = body.activo !== false;
  if (!partial || body.notas !== undefined) out.notas = String(body.notas ?? '').trim() || null;
  return out;
}

export async function listarConductores(
  supabase: SupabaseClient,
  opts?: { activo?: boolean; q?: string },
): Promise<{ items: FlotaConductor[]; migracionPendiente: boolean }> {
  let q = supabase.from('ci_flota_conductores').select(CONDUCTOR_LIST_SELECT).order('apellidos');
  if (opts?.activo != null) q = q.eq('activo', opts.activo);

  const { data, error } = await q;
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);

  let items = (data ?? []).map((row) => unwrapVehiculo(row as Record<string, unknown>));
  const needle = opts?.q?.trim().toLowerCase();
  if (needle) {
    items = items.filter((c) =>
      [c.nombres, c.apellidos, c.cedula, c.telefono, c.licencia_numero, c.vehiculo?.placa]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }
  return { items, migracionPendiente: false };
}

export async function obtenerConductor(
  supabase: SupabaseClient,
  id: string,
): Promise<{ conductor: FlotaConductor | null; migracionPendiente: boolean }> {
  const { data, error } = await supabase
    .from('ci_flota_conductores')
    .select(CONDUCTOR_LIST_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (esMigracionPendiente(error)) return { conductor: null, migracionPendiente: true };
  if (error) throw new Error(error.message);
  if (!data) return { conductor: null, migracionPendiente: false };

  const docs = await listarDocumentosConductor(supabase, id);
  return {
    conductor: { ...unwrapVehiculo(data as Record<string, unknown>), documentos: docs.items },
    migracionPendiente: docs.migracionPendiente,
  };
}

export async function crearConductor(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<FlotaConductor> {
  const { data, error } = await supabase
    .from('ci_flota_conductores')
    .insert(payloadConductor(body))
    .select(CONDUCTOR_LIST_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return unwrapVehiculo(data as Record<string, unknown>);
}

export async function actualizarConductor(
  supabase: SupabaseClient,
  id: string,
  body: Record<string, unknown>,
): Promise<FlotaConductor> {
  const { data, error } = await supabase
    .from('ci_flota_conductores')
    .update(payloadConductor(body, true))
    .eq('id', id)
    .select(CONDUCTOR_LIST_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return unwrapVehiculo(data as Record<string, unknown>);
}

export async function eliminarConductor(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('ci_flota_conductores').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listarDocumentosConductor(
  supabase: SupabaseClient,
  conductorId: string,
): Promise<{ items: FlotaConductorDocumento[]; migracionPendiente: boolean }> {
  const { data, error } = await supabase
    .from('ci_flota_conductor_documentos')
    .select('id, conductor_id, tipo, nombre, url, vence_el, created_at')
    .eq('conductor_id', conductorId)
    .order('created_at', { ascending: false });
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as FlotaConductorDocumento[], migracionPendiente: false };
}

export async function agregarDocumentoConductor(
  supabase: SupabaseClient,
  conductorId: string,
  body: Record<string, unknown>,
): Promise<FlotaConductorDocumento> {
  const tipoRaw = String(body.tipo ?? 'otro');
  const tipo = (TIPOS_DOCUMENTO_CONDUCTOR as readonly string[]).includes(tipoRaw)
    ? tipoRaw
    : 'otro';
  const nombre = String(body.nombre ?? '').trim();
  if (!nombre) throw new Error('nombre del documento requerido');

  const { data, error } = await supabase
    .from('ci_flota_conductor_documentos')
    .insert({
      conductor_id: conductorId,
      tipo,
      nombre: nombre.slice(0, 180),
      url: String(body.url ?? '').trim() || null,
      vence_el: parseFechaIso(body.vence_el),
    })
    .select('id, conductor_id, tipo, nombre, url, vence_el, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as FlotaConductorDocumento;
}

export async function eliminarDocumentoConductor(
  supabase: SupabaseClient,
  documentoId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ci_flota_conductor_documentos')
    .delete()
    .eq('id', documentoId);
  if (error) throw new Error(error.message);
}
