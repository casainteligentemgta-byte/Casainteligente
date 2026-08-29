import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import {
  TIPOS_MANTENIMIENTO,
  esMigracionPendiente,
  esUuid,
  hoyIso,
  normalizarTipoMantenimiento,
  parseFechaIso,
  parseNumero,
  type TipoMantenimiento,
} from '@/lib/flota/utils';

export type FlotaMantenimiento = {
  id: string;
  vehiculo_id: string;
  maquinaria_id?: string | null;
  fecha: string;
  fecha_mantenimiento?: string | null;
  tipo: TipoMantenimiento;
  tipo_mantenimiento?: string | null;
  descripcion: string | null;
  odometro_km: number | null;
  km_actual?: number | null;
  costo_usd: number | null;
  costo?: number | null;
  costo_bs: number | null;
  taller: string | null;
  taller_nombre?: string | null;
  proyecto_id?: string | null;
  proximo_odometro_km: number | null;
  proximo_fecha: string | null;
  factura_url: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  vehiculo?: { id: string; placa: string; marca: string | null; modelo: string | null } | null;
};

export type RegistrarMantenimientoInput = {
  maquinaria_id: string;
  tipo_mantenimiento: string;
  descripcion?: string;
  km_actual?: number;
  taller_nombre?: string;
  costo?: number;
  fecha_mantenimiento: string;
  proyecto_id?: string;
};

const MANT_SELECT = `
  id, vehiculo_id, maquinaria_id, fecha, fecha_mantenimiento, tipo, tipo_mantenimiento,
  descripcion, odometro_km, km_actual, costo_usd, costo, costo_bs, taller, taller_nombre,
  proyecto_id, proximo_odometro_km, proximo_fecha, factura_url, created_by, created_at, updated_at,
  vehiculo:ci_flota_vehiculos!vehiculo_id (id, placa, marca, modelo)
`;

const MANT_SELECT_LEGACY = `
  id, vehiculo_id, fecha, tipo, descripcion, odometro_km, costo_usd, costo_bs, taller,
  proximo_odometro_km, proximo_fecha, factura_url, created_at, updated_at,
  vehiculo:ci_flota_vehiculos!vehiculo_id (id, placa, marca, modelo)
`;

const COLUMNAS_NUEVAS_MANT = [
  'maquinaria_id',
  'tipo_mantenimiento',
  'km_actual',
  'taller_nombre',
  'costo',
  'fecha_mantenimiento',
  'proyecto_id',
  'created_by',
] as const;

function columnasNuevasFaltan(error: { message?: string } | null): boolean {
  return /maquinaria_id|tipo_mantenimiento|km_actual|taller_nombre|fecha_mantenimiento|proyecto_id|created_by|\bcosto\b/i.test(
    error?.message ?? '',
  );
}

function payloadLegacy(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const k of COLUMNAS_NUEVAS_MANT) delete out[k];
  return out;
}

function asRows(data: unknown): Record<string, unknown>[] {
  return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
}

function asRow(data: unknown): Record<string, unknown> | null {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

function unwrap(row: Record<string, unknown>): FlotaMantenimiento {
  const vehiculo = Array.isArray(row.vehiculo) ? row.vehiculo[0] : row.vehiculo;
  const fecha = String(row.fecha_mantenimiento ?? row.fecha ?? '');
  const tipoRaw = String(row.tipo_mantenimiento ?? row.tipo ?? 'preventivo');
  const km = parseNumero(row.km_actual ?? row.odometro_km);
  const costo = parseNumero(row.costo ?? row.costo_usd);
  const taller = (row.taller_nombre as string | null) ?? (row.taller as string | null) ?? null;
  return {
    ...(row as unknown as FlotaMantenimiento),
    vehiculo_id: String(row.vehiculo_id ?? row.maquinaria_id ?? ''),
    maquinaria_id: (row.maquinaria_id as string | null) ?? (row.vehiculo_id as string | null) ?? null,
    fecha,
    fecha_mantenimiento: fecha || null,
    tipo: normalizarTipoMantenimiento(String(row.tipo ?? tipoRaw)),
    tipo_mantenimiento: tipoRaw || null,
    odometro_km: km,
    km_actual: km,
    costo_usd: costo,
    costo,
    taller,
    taller_nombre: taller,
    vehiculo: vehiculo ?? null,
  };
}

function payload(body: Record<string, unknown>, partial = false): Record<string, unknown> {
  const vehiculoId = String(body.vehiculo_id ?? body.maquinaria_id ?? '').trim();
  if (!partial && !esUuid(vehiculoId)) throw new Error('maquinaria_id requerido');

  const tipoLibre = String(body.tipo_mantenimiento ?? body.tipo ?? '').trim();
  const tipo = normalizarTipoMantenimiento(tipoLibre || 'preventivo');
  if (!partial && !tipoLibre) throw new Error('tipo_mantenimiento requerido');

  const fecha =
    parseFechaIso(body.fecha_mantenimiento ?? body.fecha) ?? (partial ? null : hoyIso());
  if (!partial && !fecha) throw new Error('fecha_mantenimiento inválida');

  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!partial || body.vehiculo_id !== undefined || body.maquinaria_id !== undefined) {
    out.vehiculo_id = vehiculoId;
    out.maquinaria_id = vehiculoId;
  }
  if (!partial || body.tipo !== undefined || body.tipo_mantenimiento !== undefined) {
    out.tipo = tipo;
    out.tipo_mantenimiento = tipoLibre || tipo;
  }
  if (!partial || body.fecha !== undefined || body.fecha_mantenimiento !== undefined) {
    out.fecha = fecha;
    out.fecha_mantenimiento = fecha;
  }
  if (!partial || body.descripcion !== undefined) {
    out.descripcion = String(body.descripcion ?? '').trim() || null;
  }
  if (!partial || body.odometro_km !== undefined || body.km_actual !== undefined) {
    const km = parseNumero(body.km_actual ?? body.odometro_km);
    out.odometro_km = km;
    out.km_actual = km;
  }
  if (!partial || body.costo_usd !== undefined || body.costo !== undefined) {
    const costo = parseNumero(body.costo ?? body.costo_usd);
    out.costo_usd = costo;
    out.costo = costo;
  }
  if (!partial || body.costo_bs !== undefined) out.costo_bs = parseNumero(body.costo_bs);
  if (!partial || body.taller !== undefined || body.taller_nombre !== undefined) {
    const taller = String(body.taller_nombre ?? body.taller ?? '').trim() || null;
    out.taller = taller;
    out.taller_nombre = taller;
  }
  if (!partial || body.proyecto_id !== undefined) {
    out.proyecto_id = esUuid(String(body.proyecto_id ?? '')) ? String(body.proyecto_id) : null;
  }
  if (!partial || body.created_by !== undefined) {
    out.created_by = esUuid(String(body.created_by ?? '')) ? String(body.created_by) : null;
  }
  if (!partial || body.proximo_odometro_km !== undefined) {
    out.proximo_odometro_km = parseNumero(body.proximo_odometro_km);
  }
  if (!partial || body.proximo_fecha !== undefined) out.proximo_fecha = parseFechaIso(body.proximo_fecha);
  if (!partial || body.factura_url !== undefined) {
    out.factura_url = String(body.factura_url ?? '').trim() || null;
  }
  return out;
}

async function insertarServicio(body: Record<string, unknown>): Promise<FlotaMantenimiento> {
  const supabase = await createServerClient();
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const row = payload({ ...body, created_by: userId });

  let result = await supabase.from('ci_flota_mantenimiento').insert([row]).select(MANT_SELECT).single();
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await supabase
      .from('ci_flota_mantenimiento')
      .insert([payloadLegacy(row)])
      .select(MANT_SELECT_LEGACY)
      .single();
  }
  if (result.error) throw result.error;

  const odometro = parseNumero(row.odometro_km ?? row.km_actual);
  if (odometro != null && esUuid(String(row.vehiculo_id))) {
    await supabase
      .from('ci_flota_vehiculos')
      .update({ odometro_km: odometro, updated_at: new Date().toISOString() })
      .eq('id', row.vehiculo_id)
      .lt('odometro_km', odometro);
  }

  return unwrap(asRow(result.data) ?? {});
}

export async function registrarMantenimiento(
  data: RegistrarMantenimientoInput,
): Promise<FlotaMantenimiento> {
  if (!esUuid(data.maquinaria_id)) throw new Error('maquinaria_id requerido');
  if (!String(data.tipo_mantenimiento ?? '').trim()) throw new Error('tipo_mantenimiento requerido');
  if (!parseFechaIso(data.fecha_mantenimiento)) throw new Error('fecha_mantenimiento inválida');

  return insertarServicio({
    maquinaria_id: data.maquinaria_id,
    tipo_mantenimiento: data.tipo_mantenimiento,
    descripcion: data.descripcion,
    km_actual: data.km_actual,
    taller_nombre: data.taller_nombre,
    costo: data.costo,
    fecha_mantenimiento: data.fecha_mantenimiento,
    proyecto_id: data.proyecto_id,
  });
}

export async function obtenerMantenimientoPorMaquinaria(
  maquinaria_id: string,
): Promise<FlotaMantenimiento[]> {
  if (!esUuid(maquinaria_id)) throw new Error('maquinaria_id requerido');
  const supabase = await createServerClient();

  const query = (col: 'maquinaria_id' | 'vehiculo_id', cols: string, orden: string) =>
    supabase
      .from('ci_flota_mantenimiento')
      .select(cols)
      .eq(col, maquinaria_id)
      .order(orden, { ascending: false });

  let result = await query('maquinaria_id', MANT_SELECT, 'fecha_mantenimiento');
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await query('vehiculo_id', MANT_SELECT_LEGACY, 'fecha');
  }
  if (result.error) throw result.error;
  return asRows(result.data).map(unwrap);
}

export async function listarMantenimientos(
  supabase: SupabaseClient,
  opts?: { vehiculoId?: string; tipo?: string },
): Promise<{ items: FlotaMantenimiento[]; migracionPendiente: boolean }> {
  const ejecutar = async (cols: string) => {
    let q = supabase.from('ci_flota_mantenimiento').select(cols).order('fecha', { ascending: false });
    if (opts?.vehiculoId) q = q.eq('vehiculo_id', opts.vehiculoId);
    if (opts?.tipo && (TIPOS_MANTENIMIENTO as readonly string[]).includes(opts.tipo)) {
      q = q.eq('tipo', opts.tipo);
    }
    return q.limit(400);
  };

  let result = await ejecutar(MANT_SELECT);
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await ejecutar(MANT_SELECT_LEGACY);
  }
  if (esMigracionPendiente(result.error)) return { items: [], migracionPendiente: true };
  if (result.error) throw new Error(result.error.message);
  return { items: asRows(result.data).map(unwrap), migracionPendiente: false };
}

export async function obtenerMantenimiento(
  supabase: SupabaseClient,
  id: string,
): Promise<{ item: FlotaMantenimiento | null; migracionPendiente: boolean }> {
  let result = await supabase.from('ci_flota_mantenimiento').select(MANT_SELECT).eq('id', id).maybeSingle();
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await supabase
      .from('ci_flota_mantenimiento')
      .select(MANT_SELECT_LEGACY)
      .eq('id', id)
      .maybeSingle();
  }
  if (esMigracionPendiente(result.error)) return { item: null, migracionPendiente: true };
  if (result.error) throw new Error(result.error.message);
  const row = asRow(result.data);
  return { item: row ? unwrap(row) : null, migracionPendiente: false };
}

export async function crearMantenimiento(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<FlotaMantenimiento> {
  void supabase;
  return insertarServicio(body);
}

export async function actualizarMantenimiento(
  supabase: SupabaseClient,
  id: string,
  body: Record<string, unknown>,
): Promise<FlotaMantenimiento> {
  const patch = payload(body, true);
  let result = await supabase
    .from('ci_flota_mantenimiento')
    .update(patch)
    .eq('id', id)
    .select(MANT_SELECT)
    .single();
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await supabase
      .from('ci_flota_mantenimiento')
      .update(payloadLegacy(patch))
      .eq('id', id)
      .select(MANT_SELECT_LEGACY)
      .single();
  }
  if (result.error) throw new Error(result.error.message);
  return unwrap(asRow(result.data) ?? {});
}

export async function eliminarMantenimiento(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('ci_flota_mantenimiento').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export const ETIQUETA_TIPO_MANTENIMIENTO: Record<TipoMantenimiento, string> = {
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
  cambio_aceite: 'Cambio de aceite',
  gomas: 'Gomas',
  frenos: 'Frenos',
  revision: 'Revisión',
  otro: 'Otro',
};
