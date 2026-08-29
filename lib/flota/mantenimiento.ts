import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TIPOS_MANTENIMIENTO,
  esMigracionPendiente,
  esUuid,
  hoyIso,
  parseFechaIso,
  parseNumero,
} from '@/lib/flota/utils';

export type FlotaMantenimiento = {
  id: string;
  vehiculo_id: string;
  fecha: string;
  tipo: (typeof TIPOS_MANTENIMIENTO)[number];
  descripcion: string | null;
  odometro_km: number | null;
  costo_usd: number | null;
  costo_bs: number | null;
  taller: string | null;
  proximo_odometro_km: number | null;
  proximo_fecha: string | null;
  factura_url: string | null;
  created_at: string;
  updated_at: string;
  vehiculo?: { id: string; placa: string; marca: string | null; modelo: string | null } | null;
};

const MANT_SELECT = `
  id, vehiculo_id, fecha, tipo, descripcion, odometro_km, costo_usd, costo_bs, taller,
  proximo_odometro_km, proximo_fecha, factura_url, created_at, updated_at,
  vehiculo:ci_flota_vehiculos!vehiculo_id (id, placa, marca, modelo)
`;

function unwrap(row: Record<string, unknown>): FlotaMantenimiento {
  const vehiculo = Array.isArray(row.vehiculo) ? row.vehiculo[0] : row.vehiculo;
  return { ...(row as unknown as FlotaMantenimiento), vehiculo: vehiculo ?? null };
}

function payload(body: Record<string, unknown>, partial = false): Record<string, unknown> {
  const vehiculoId = String(body.vehiculo_id ?? '').trim();
  if (!partial && !esUuid(vehiculoId)) throw new Error('vehiculo_id requerido');

  const tipoRaw = String(body.tipo ?? 'preventivo');
  const tipo = (TIPOS_MANTENIMIENTO as readonly string[]).includes(tipoRaw) ? tipoRaw : 'preventivo';

  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!partial || body.vehiculo_id !== undefined) out.vehiculo_id = vehiculoId;
  if (!partial || body.tipo !== undefined) out.tipo = tipo;
  if (!partial || body.fecha !== undefined) out.fecha = parseFechaIso(body.fecha) ?? hoyIso();
  if (!partial || body.descripcion !== undefined) {
    out.descripcion = String(body.descripcion ?? '').trim() || null;
  }
  if (!partial || body.odometro_km !== undefined) out.odometro_km = parseNumero(body.odometro_km);
  if (!partial || body.costo_usd !== undefined) out.costo_usd = parseNumero(body.costo_usd);
  if (!partial || body.costo_bs !== undefined) out.costo_bs = parseNumero(body.costo_bs);
  if (!partial || body.taller !== undefined) out.taller = String(body.taller ?? '').trim() || null;
  if (!partial || body.proximo_odometro_km !== undefined) {
    out.proximo_odometro_km = parseNumero(body.proximo_odometro_km);
  }
  if (!partial || body.proximo_fecha !== undefined) out.proximo_fecha = parseFechaIso(body.proximo_fecha);
  if (!partial || body.factura_url !== undefined) {
    out.factura_url = String(body.factura_url ?? '').trim() || null;
  }
  return out;
}

export async function listarMantenimientos(
  supabase: SupabaseClient,
  opts?: { vehiculoId?: string; tipo?: string },
): Promise<{ items: FlotaMantenimiento[]; migracionPendiente: boolean }> {
  let q = supabase.from('ci_flota_mantenimiento').select(MANT_SELECT).order('fecha', { ascending: false });
  if (opts?.vehiculoId) q = q.eq('vehiculo_id', opts.vehiculoId);
  if (opts?.tipo && (TIPOS_MANTENIMIENTO as readonly string[]).includes(opts.tipo)) {
    q = q.eq('tipo', opts.tipo);
  }
  const { data, error } = await q.limit(400);
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { items: (data ?? []).map((r) => unwrap(r as Record<string, unknown>)), migracionPendiente: false };
}

export async function obtenerMantenimiento(
  supabase: SupabaseClient,
  id: string,
): Promise<{ item: FlotaMantenimiento | null; migracionPendiente: boolean }> {
  const { data, error } = await supabase
    .from('ci_flota_mantenimiento')
    .select(MANT_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (esMigracionPendiente(error)) return { item: null, migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { item: data ? unwrap(data as Record<string, unknown>) : null, migracionPendiente: false };
}

export async function crearMantenimiento(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<FlotaMantenimiento> {
  const row = payload(body);
  const { data, error } = await supabase
    .from('ci_flota_mantenimiento')
    .insert(row)
    .select(MANT_SELECT)
    .single();
  if (error) throw new Error(error.message);

  const odometro = parseNumero(row.odometro_km);
  if (odometro != null && esUuid(String(row.vehiculo_id))) {
    await supabase
      .from('ci_flota_vehiculos')
      .update({ odometro_km: odometro, updated_at: new Date().toISOString() })
      .eq('id', row.vehiculo_id)
      .lt('odometro_km', odometro);
  }

  return unwrap(data as Record<string, unknown>);
}

export async function actualizarMantenimiento(
  supabase: SupabaseClient,
  id: string,
  body: Record<string, unknown>,
): Promise<FlotaMantenimiento> {
  const { data, error } = await supabase
    .from('ci_flota_mantenimiento')
    .update(payload(body, true))
    .eq('id', id)
    .select(MANT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return unwrap(data as Record<string, unknown>);
}

export async function eliminarMantenimiento(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('ci_flota_mantenimiento').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export const ETIQUETA_TIPO_MANTENIMIENTO: Record<(typeof TIPOS_MANTENIMIENTO)[number], string> = {
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
  cambio_aceite: 'Cambio de aceite',
  gomas: 'Gomas',
  frenos: 'Frenos',
  revision: 'Revisión',
  otro: 'Otro',
};
