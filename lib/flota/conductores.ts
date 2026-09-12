import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import { mensajeErrorFlota, throwFlotaError } from '@/lib/flota/error';
import {
  TIPOS_DOCUMENTO_CONDUCTOR,
  TIPOS_LICENCIA,
  esMigracionPendiente,
  esUuid,
  parseFechaIso,
  partirNombreCompleto,
  unirNombreCompleto,
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
  nombre_completo: string | null;
  nombres: string;
  apellidos: string;
  cedula: string | null;
  numero_cedula: string | null;
  telefono: string | null;
  email: string | null;
  tipo_licencia: string | null;
  licencia_numero: string | null;
  fecha_vencimiento_licencia: string | null;
  fecha_vencimiento_salud: string | null;
  licencia_vence: string | null;
  certificado_medico_vence: string | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
  vehiculo?: Pick<FlotaVehiculo, 'id' | 'placa' | 'marca' | 'modelo'> | null;
  documentos?: FlotaConductorDocumento[];
};

export type CrearConductorInput = {
  entidad_id: string;
  nombre_completo: string;
  cedula: string;
  numero_cedula?: string;
  fecha_vencimiento_licencia?: string;
  fecha_vencimiento_salud?: string;
  empleado_id?: string;
  telefono?: string;
  email?: string;
  tipo_licencia?: string;
  vehiculo_asignado_id?: string;
  proyecto_id?: string;
  notas?: string;
  activo?: boolean;
};

const CONDUCTOR_SELECT =
  'id, empleado_id, entidad_id, proyecto_id, vehiculo_asignado_id, nombre_completo, nombres, apellidos, cedula, numero_cedula, telefono, email, tipo_licencia, licencia_numero, fecha_vencimiento_licencia, fecha_vencimiento_salud, licencia_vence, certificado_medico_vence, activo, notas, created_at, updated_at';

const CONDUCTOR_LIST_SELECT = `${CONDUCTOR_SELECT}, vehiculo:ci_flota_vehiculos!vehiculo_asignado_id (id, placa, marca, modelo)`;

const CONDUCTOR_SELECT_LEGACY =
  'id, empleado_id, entidad_id, proyecto_id, vehiculo_asignado_id, nombres, apellidos, cedula, telefono, email, tipo_licencia, licencia_numero, licencia_vence, certificado_medico_vence, activo, notas, created_at, updated_at';

const CONDUCTOR_LIST_SELECT_LEGACY = `${CONDUCTOR_SELECT_LEGACY}, vehiculo:ci_flota_vehiculos!vehiculo_asignado_id (id, placa, marca, modelo)`;

function columnasNuevasFaltan(error: { message?: string; code?: string } | null): boolean {
  return /nombre_completo|numero_cedula|fecha_vencimiento_licencia|fecha_vencimiento_salud|PGRST204/i.test(
    `${error?.code ?? ''} ${error?.message ?? ''}`,
  );
}

function relacionVehiculoFalta(error: { message?: string; code?: string } | null): boolean {
  return /could not find a relationship|PGRST200|PGRST201/i.test(
    `${error?.code ?? ''} ${error?.message ?? ''}`,
  );
}

function sinColumnasNuevas(row: Record<string, unknown>): Record<string, unknown> {
  const legacy = { ...row };
  delete legacy.nombre_completo;
  delete legacy.numero_cedula;
  delete legacy.fecha_vencimiento_licencia;
  delete legacy.fecha_vencimiento_salud;
  return legacy;
}

async function clienteFlota(supabase?: SupabaseClient): Promise<SupabaseClient> {
  return supabase ?? (await createServerClient());
}

function unwrapVehiculo(row: Record<string, unknown>): FlotaConductor {
  const raw = row.vehiculo;
  const vehiculo = Array.isArray(raw) ? raw[0] : raw;
  const c = { ...(row as unknown as FlotaConductor), vehiculo: vehiculo ?? null };
  if (!c.nombre_completo) c.nombre_completo = unirNombreCompleto(c.nombres, c.apellidos) || null;
  if (!c.licencia_vence) c.licencia_vence = c.fecha_vencimiento_licencia;
  if (!c.certificado_medico_vence) c.certificado_medico_vence = c.fecha_vencimiento_salud;
  return c;
}

function payloadConductor(body: Record<string, unknown>, partial = false): Record<string, unknown> {
  const nombreCompletoRaw =
    String(body.nombre_completo ?? '').trim() ||
    unirNombreCompleto(String(body.nombres ?? ''), String(body.apellidos ?? ''));
  const partido = partirNombreCompleto(nombreCompletoRaw);
  const nombres = String(body.nombres ?? partido.nombres).trim();
  const apellidos = String(body.apellidos ?? partido.apellidos).trim();
  if (!partial && !nombres && !nombreCompletoRaw) throw new Error('nombre_completo requerido');

  const tipoLic = body.tipo_licencia != null ? String(body.tipo_licencia).trim() : '';
  const tipoOk = (TIPOS_LICENCIA as readonly string[]).includes(tipoLic) ? tipoLic : tipoLic || null;

  const cedula = String(body.cedula ?? body.numero_cedula ?? '').trim() || null;
  const licenciaVence =
    parseFechaIso(body.fecha_vencimiento_licencia) ?? parseFechaIso(body.licencia_vence);
  const saludVence =
    parseFechaIso(body.fecha_vencimiento_salud) ?? parseFechaIso(body.certificado_medico_vence);

  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!partial || body.nombre_completo !== undefined || body.nombres !== undefined || body.apellidos !== undefined) {
    out.nombre_completo = nombreCompletoRaw || unirNombreCompleto(nombres, apellidos) || null;
    out.nombres = nombres || (nombreCompletoRaw ? partido.nombres : '');
    out.apellidos = apellidos || (nombreCompletoRaw ? partido.apellidos : '');
    if (!partial && !out.nombres) throw new Error('nombre_completo requerido');
    if (!partial && !out.apellidos) out.apellidos = String(out.nombres);
  }
  if (!partial || body.cedula !== undefined || body.numero_cedula !== undefined) {
    out.cedula = cedula;
    out.numero_cedula = String(body.numero_cedula ?? cedula ?? '').trim() || cedula;
  }
  if (!partial || body.telefono !== undefined) out.telefono = String(body.telefono ?? '').trim() || null;
  if (!partial || body.email !== undefined) out.email = String(body.email ?? '').trim() || null;
  if (!partial || body.tipo_licencia !== undefined) out.tipo_licencia = tipoOk;
  if (!partial || body.licencia_numero !== undefined) {
    out.licencia_numero = String(body.licencia_numero ?? '').trim() || null;
  }
  if (
    !partial ||
    body.fecha_vencimiento_licencia !== undefined ||
    body.licencia_vence !== undefined
  ) {
    out.fecha_vencimiento_licencia = licenciaVence;
    out.licencia_vence = licenciaVence;
  }
  if (
    !partial ||
    body.fecha_vencimiento_salud !== undefined ||
    body.certificado_medico_vence !== undefined
  ) {
    out.fecha_vencimiento_salud = saludVence;
    out.certificado_medico_vence = saludVence;
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

async function escribirConductor(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  modo: 'insert' | 'update',
  id?: string,
) {
  const intentos: { payload: Record<string, unknown>; select: string }[] = [
    { payload: row, select: CONDUCTOR_LIST_SELECT },
    { payload: sinColumnasNuevas(row), select: CONDUCTOR_LIST_SELECT_LEGACY },
    { payload: row, select: CONDUCTOR_SELECT },
    { payload: sinColumnasNuevas(row), select: CONDUCTOR_SELECT_LEGACY },
  ];

  let lastError: { message?: string; code?: string } | null = null;
  for (const intento of intentos) {
    const q =
      modo === 'insert'
        ? supabase.from('ci_flota_conductores').insert([intento.payload])
        : supabase.from('ci_flota_conductores').update(intento.payload).eq('id', id ?? '');
    const result = await q.select(intento.select).single();
    if (!result.error) return unwrapVehiculo(result.data as Record<string, unknown>);
    lastError = result.error;
    if (esMigracionPendiente(result.error) && !columnasNuevasFaltan(result.error) && !relacionVehiculoFalta(result.error)) {
      break;
    }
    if (!columnasNuevasFaltan(result.error) && !relacionVehiculoFalta(result.error)) break;
  }

  throwFlotaError(lastError, modo === 'insert' ? 'No se pudo registrar el conductor' : 'No se pudo actualizar el conductor');
}

export async function crearConductor(
  data: CrearConductorInput | Record<string, unknown>,
  supabaseClient?: SupabaseClient,
) {
  const rec = data as Record<string, unknown>;
  const nombre =
    String(rec.nombre_completo ?? '').trim() ||
    unirNombreCompleto(String(rec.nombres ?? ''), String(rec.apellidos ?? ''));
  if (!nombre) throw new Error('nombre_completo requerido');
  if (!String(rec.cedula ?? '').trim() && !String(rec.numero_cedula ?? '').trim()) {
    throw new Error('cedula requerida');
  }

  const supabase = await clienteFlota(supabaseClient);
  const row = payloadConductor({
    ...rec,
    nombre_completo: nombre,
    cedula: rec.cedula ?? rec.numero_cedula,
    numero_cedula: rec.numero_cedula ?? rec.cedula,
    fecha_vencimiento_licencia: rec.fecha_vencimiento_licencia ?? rec.licencia_vence,
    fecha_vencimiento_salud: rec.fecha_vencimiento_salud ?? rec.certificado_medico_vence,
    empleado_id: rec.empleado_id,
    entidad_id: rec.entidad_id,
  });

  return escribirConductor(supabase, row, 'insert');
}

export async function obtenerConductores(entidad_id: string, supabaseClient?: SupabaseClient) {
  const supabase = await clienteFlota(supabaseClient);

  const selects = [CONDUCTOR_LIST_SELECT, CONDUCTOR_LIST_SELECT_LEGACY, CONDUCTOR_SELECT, CONDUCTOR_SELECT_LEGACY];
  let data: unknown;
  let error: { message?: string; code?: string } | null = null;
  for (const cols of selects) {
    let q = supabase.from('ci_flota_conductores').select(cols).order('created_at', { ascending: false });
    if (esUuid(entidad_id)) q = q.eq('entidad_id', entidad_id);
    const result = await q;
    data = result.data;
    error = result.error;
    if (!error) break;
    if (!columnasNuevasFaltan(error) && !relacionVehiculoFalta(error)) break;
  }
  if (error) throwFlotaError(error, 'No se pudieron cargar los conductores');
  return (Array.isArray(data) ? data : []).map((row) => unwrapVehiculo(row as Record<string, unknown>));
}

export async function actualizarConductor(
  id: string,
  data: Partial<Database['public']['Tables']['ci_flota_conductores']['Update']>,
  supabaseClient?: SupabaseClient,
) {
  const supabase = await clienteFlota(supabaseClient);
  const patch = payloadConductor(data as Record<string, unknown>, true);
  return escribirConductor(supabase, patch, 'update', id);
}

export async function listarConductores(
  supabase: SupabaseClient,
  opts?: { activo?: boolean; q?: string; entidadId?: string },
): Promise<{ items: FlotaConductor[]; migracionPendiente: boolean }> {
  const selects = [CONDUCTOR_LIST_SELECT, CONDUCTOR_LIST_SELECT_LEGACY, CONDUCTOR_SELECT, CONDUCTOR_SELECT_LEGACY];
  let data: unknown;
  let error: { message?: string; code?: string } | null = null;
  for (const cols of selects) {
    let q = supabase.from('ci_flota_conductores').select(cols).order('created_at', { ascending: false });
    if (opts?.activo != null) q = q.eq('activo', opts.activo);
    if (opts?.entidadId && esUuid(opts.entidadId)) q = q.eq('entidad_id', opts.entidadId);
    const result = await q;
    data = result.data;
    error = result.error;
    if (!error) break;
    if (esMigracionPendiente(error) && !columnasNuevasFaltan(error) && !relacionVehiculoFalta(error)) {
      return { items: [], migracionPendiente: true };
    }
    if (!columnasNuevasFaltan(error) && !relacionVehiculoFalta(error)) break;
  }
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(mensajeErrorFlota(error, 'No se pudieron cargar los conductores'));

  let items = (Array.isArray(data) ? data : []).map((row) => unwrapVehiculo(row as Record<string, unknown>));
  const needle = opts?.q?.trim().toLowerCase();
  if (needle) {
    items = items.filter((c) =>
      [
        c.nombre_completo,
        c.nombres,
        c.apellidos,
        c.cedula,
        c.numero_cedula,
        c.telefono,
        c.licencia_numero,
        c.vehiculo?.placa,
      ]
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
  const selects = [CONDUCTOR_LIST_SELECT, CONDUCTOR_LIST_SELECT_LEGACY, CONDUCTOR_SELECT, CONDUCTOR_SELECT_LEGACY];
  let data: unknown;
  let error: { message?: string; code?: string } | null = null;
  for (const cols of selects) {
    const result = await supabase.from('ci_flota_conductores').select(cols).eq('id', id).maybeSingle();
    data = result.data;
    error = result.error;
    if (!error) break;
    if (esMigracionPendiente(error) && !columnasNuevasFaltan(error) && !relacionVehiculoFalta(error)) {
      return { conductor: null, migracionPendiente: true };
    }
    if (!columnasNuevasFaltan(error) && !relacionVehiculoFalta(error)) break;
  }
  if (esMigracionPendiente(error)) return { conductor: null, migracionPendiente: true };
  if (error) throw new Error(mensajeErrorFlota(error, 'No se pudo cargar el conductor'));
  if (!data) return { conductor: null, migracionPendiente: false };

  const docs = await listarDocumentosConductor(supabase, id);
  return {
    conductor: { ...unwrapVehiculo(data as Record<string, unknown>), documentos: docs.items },
    migracionPendiente: docs.migracionPendiente,
  };
}

export async function eliminarConductor(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('ci_flota_conductores').delete().eq('id', id);
  if (error) throw new Error(mensajeErrorFlota(error, 'No se pudo eliminar el conductor'));
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
  if (error) throw new Error(mensajeErrorFlota(error, 'No se pudieron cargar los documentos'));
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
  if (error) throw new Error(mensajeErrorFlota(error, 'No se pudo agregar el documento'));
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
  if (error) throw new Error(mensajeErrorFlota(error, 'No se pudo eliminar el documento'));
}
