import type { SupabaseClient } from '@supabase/supabase-js';
import {
  consumoKmPorLitro,
  esMigracionPendiente,
  esUuid,
  hoyIso,
  parseFechaIso,
  parseNumero,
} from '@/lib/flota/utils';

export type FlotaGasolina = {
  id: string;
  vehiculo_id: string;
  conductor_id: string | null;
  entidad_id: string | null;
  proyecto_id: string | null;
  fecha: string;
  litros: number;
  odometro_km: number | null;
  precio_litro_usd: number | null;
  precio_litro_bs: number | null;
  monto_usd: number | null;
  monto_bs: number | null;
  estacion: string | null;
  factura_url: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  vehiculo?: { id: string; placa: string; marca: string | null; modelo: string | null } | null;
  conductor?: { id: string; nombres: string; apellidos: string } | null;
};

export type ConsumoPorVehiculo = {
  vehiculo_id: string;
  placa: string;
  etiqueta: string;
  cargas: number;
  litros: number;
  km: number;
  km_por_litro: number | null;
  monto_usd: number;
  monto_bs: number;
  ultima_fecha: string | null;
};

export type AnalisisConsumo = {
  desde: string | null;
  hasta: string | null;
  total_cargas: number;
  total_litros: number;
  total_usd: number;
  total_bs: number;
  promedio_km_l: number | null;
  por_vehiculo: ConsumoPorVehiculo[];
};

const GASOLINA_SELECT = `
  id, vehiculo_id, conductor_id, entidad_id, proyecto_id, fecha, litros, odometro_km,
  precio_litro_usd, precio_litro_bs, monto_usd, monto_bs, estacion, factura_url, notas,
  created_at, updated_at,
  vehiculo:ci_flota_vehiculos!vehiculo_id (id, placa, marca, modelo),
  conductor:ci_flota_conductores!conductor_id (id, nombres, apellidos)
`;

function unwrap(row: Record<string, unknown>): FlotaGasolina {
  const vehiculo = Array.isArray(row.vehiculo) ? row.vehiculo[0] : row.vehiculo;
  const conductor = Array.isArray(row.conductor) ? row.conductor[0] : row.conductor;
  return { ...(row as unknown as FlotaGasolina), vehiculo: vehiculo ?? null, conductor: conductor ?? null };
}

function payload(body: Record<string, unknown>, partial = false): Record<string, unknown> {
  const vehiculoId = String(body.vehiculo_id ?? '').trim();
  if (!partial && !esUuid(vehiculoId)) throw new Error('vehiculo_id requerido');

  const litros = parseNumero(body.litros);
  if (!partial && (litros == null || litros <= 0)) throw new Error('litros debe ser mayor a 0');

  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!partial || body.vehiculo_id !== undefined) out.vehiculo_id = vehiculoId;
  if (!partial || body.litros !== undefined) {
    if (litros == null || litros <= 0) throw new Error('litros debe ser mayor a 0');
    out.litros = litros;
  }
  if (!partial || body.fecha !== undefined) out.fecha = parseFechaIso(body.fecha) ?? hoyIso();
  if (!partial || body.odometro_km !== undefined) out.odometro_km = parseNumero(body.odometro_km);
  if (!partial || body.precio_litro_usd !== undefined) {
    out.precio_litro_usd = parseNumero(body.precio_litro_usd);
  }
  if (!partial || body.precio_litro_bs !== undefined) {
    out.precio_litro_bs = parseNumero(body.precio_litro_bs);
  }
  if (!partial || body.monto_usd !== undefined) out.monto_usd = parseNumero(body.monto_usd);
  if (!partial || body.monto_bs !== undefined) out.monto_bs = parseNumero(body.monto_bs);
  if (!partial || body.estacion !== undefined) out.estacion = String(body.estacion ?? '').trim() || null;
  if (!partial || body.conductor_id !== undefined) {
    out.conductor_id = esUuid(String(body.conductor_id ?? '')) ? String(body.conductor_id) : null;
  }
  if (!partial || body.entidad_id !== undefined) {
    out.entidad_id = esUuid(String(body.entidad_id ?? '')) ? String(body.entidad_id) : null;
  }
  if (!partial || body.proyecto_id !== undefined) {
    out.proyecto_id = esUuid(String(body.proyecto_id ?? '')) ? String(body.proyecto_id) : null;
  }
  if (!partial || body.factura_url !== undefined) {
    out.factura_url = String(body.factura_url ?? '').trim() || null;
  }
  if (!partial || body.notas !== undefined) out.notas = String(body.notas ?? '').trim() || null;

  const litrosFinal = (out.litros as number | undefined) ?? litros;
  if (out.monto_usd == null && out.precio_litro_usd != null && litrosFinal) {
    out.monto_usd = Math.round(Number(out.precio_litro_usd) * litrosFinal * 100) / 100;
  }
  if (out.monto_bs == null && out.precio_litro_bs != null && litrosFinal) {
    out.monto_bs = Math.round(Number(out.precio_litro_bs) * litrosFinal * 100) / 100;
  }
  return out;
}

export async function listarGasolina(
  supabase: SupabaseClient,
  opts?: { vehiculoId?: string; conductorId?: string; desde?: string; hasta?: string },
): Promise<{ items: FlotaGasolina[]; migracionPendiente: boolean }> {
  let q = supabase.from('ci_flota_gasolina').select(GASOLINA_SELECT).order('fecha', { ascending: false });
  if (opts?.vehiculoId) q = q.eq('vehiculo_id', opts.vehiculoId);
  if (opts?.conductorId) q = q.eq('conductor_id', opts.conductorId);
  if (opts?.desde) q = q.gte('fecha', opts.desde);
  if (opts?.hasta) q = q.lte('fecha', opts.hasta);

  const { data, error } = await q.limit(500);
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { items: (data ?? []).map((r) => unwrap(r as Record<string, unknown>)), migracionPendiente: false };
}

export async function obtenerGasolina(
  supabase: SupabaseClient,
  id: string,
): Promise<{ item: FlotaGasolina | null; migracionPendiente: boolean }> {
  const { data, error } = await supabase
    .from('ci_flota_gasolina')
    .select(GASOLINA_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (esMigracionPendiente(error)) return { item: null, migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { item: data ? unwrap(data as Record<string, unknown>) : null, migracionPendiente: false };
}

export async function crearGasolina(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<FlotaGasolina> {
  const row = payload(body);
  const { data, error } = await supabase
    .from('ci_flota_gasolina')
    .insert(row)
    .select(GASOLINA_SELECT)
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

export async function actualizarGasolina(
  supabase: SupabaseClient,
  id: string,
  body: Record<string, unknown>,
): Promise<FlotaGasolina> {
  const { data, error } = await supabase
    .from('ci_flota_gasolina')
    .update(payload(body, true))
    .eq('id', id)
    .select(GASOLINA_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return unwrap(data as Record<string, unknown>);
}

export async function eliminarGasolina(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('ci_flota_gasolina').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function analizarConsumo(registros: FlotaGasolina[]): AnalisisConsumo {
  const sorted = [...registros].sort((a, b) => {
    const fa = a.fecha.localeCompare(b.fecha);
    if (fa !== 0) return fa;
    return (a.odometro_km ?? 0) - (b.odometro_km ?? 0);
  });

  const byVeh = new Map<
    string,
    {
      placa: string;
      etiqueta: string;
      cargas: FlotaGasolina[];
    }
  >();

  for (const r of sorted) {
    const placa = r.vehiculo?.placa ?? 's/placa';
    const extra = [r.vehiculo?.marca, r.vehiculo?.modelo].filter(Boolean).join(' ');
    const cur = byVeh.get(r.vehiculo_id) ?? {
      placa,
      etiqueta: extra ? `${placa} · ${extra}` : placa,
      cargas: [],
    };
    cur.cargas.push(r);
    byVeh.set(r.vehiculo_id, cur);
  }

  const por_vehiculo: ConsumoPorVehiculo[] = [];
  let litrosTot = 0;
  let usdTot = 0;
  let bsTot = 0;
  const kmLVals: number[] = [];

  for (const [vehiculo_id, g] of byVeh) {
    let km = 0;
    const kmL: number[] = [];
    for (let i = 1; i < g.cargas.length; i++) {
      const prev = g.cargas[i - 1];
      const curr = g.cargas[i];
      const ratio = consumoKmPorLitro({
        odometroAnterior: prev.odometro_km,
        odometroActual: curr.odometro_km,
        litros: Number(curr.litros),
      });
      if (ratio != null && curr.odometro_km != null && prev.odometro_km != null) {
        km += curr.odometro_km - prev.odometro_km;
        kmL.push(ratio);
        kmLVals.push(ratio);
      }
    }
    const litros = g.cargas.reduce((s, r) => s + Number(r.litros ?? 0), 0);
    const monto_usd = g.cargas.reduce((s, r) => s + Number(r.monto_usd ?? 0), 0);
    const monto_bs = g.cargas.reduce((s, r) => s + Number(r.monto_bs ?? 0), 0);
    litrosTot += litros;
    usdTot += monto_usd;
    bsTot += monto_bs;
    const avg = kmL.length ? Math.round((kmL.reduce((a, b) => a + b, 0) / kmL.length) * 100) / 100 : null;
    por_vehiculo.push({
      vehiculo_id,
      placa: g.placa,
      etiqueta: g.etiqueta,
      cargas: g.cargas.length,
      litros: Math.round(litros * 100) / 100,
      km: Math.round(km * 10) / 10,
      km_por_litro: avg,
      monto_usd: Math.round(monto_usd * 100) / 100,
      monto_bs: Math.round(monto_bs * 100) / 100,
      ultima_fecha: g.cargas[g.cargas.length - 1]?.fecha ?? null,
    });
  }

  por_vehiculo.sort((a, b) => a.placa.localeCompare(b.placa));

  return {
    desde: sorted[0]?.fecha ?? null,
    hasta: sorted[sorted.length - 1]?.fecha ?? null,
    total_cargas: registros.length,
    total_litros: Math.round(litrosTot * 100) / 100,
    total_usd: Math.round(usdTot * 100) / 100,
    total_bs: Math.round(bsTot * 100) / 100,
    promedio_km_l: kmLVals.length
      ? Math.round((kmLVals.reduce((a, b) => a + b, 0) / kmLVals.length) * 100) / 100
      : null,
    por_vehiculo,
  };
}
