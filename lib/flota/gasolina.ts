import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import {
  calcularConsumoDesdeRegistros,
  consumoKmPorLitro,
  esMigracionPendiente,
  esUuid,
  hoyIso,
  parseFechaIso,
  parseNumero,
} from '@/lib/flota/utils';

export { calcularConsumoDesdeRegistros } from '@/lib/flota/utils';

export type FlotaGasolina = {
  id: string;
  vehiculo_id: string;
  maquinaria_id?: string | null;
  conductor_id: string | null;
  entidad_id: string | null;
  proyecto_id: string | null;
  fecha: string;
  litros: number;
  cantidad_litros?: number | null;
  odometro_km: number | null;
  km_actual?: number | null;
  precio_litro_usd: number | null;
  precio_litro_bs: number | null;
  monto_usd: number | null;
  costo_total?: number | null;
  monto_bs: number | null;
  estacion: string | null;
  estacion_gasolina?: string | null;
  tipo_gasolina?: string | null;
  factura_url: string | null;
  notas: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  vehiculo?: { id: string; placa: string; marca: string | null; modelo: string | null } | null;
  conductor?: { id: string; nombres: string; apellidos: string } | null;
};

export type RegistrarGasolinaInput = {
  maquinaria_id: string;
  cantidad_litros: number;
  costo_total: number;
  km_actual?: number;
  tipo_gasolina?: string;
  estacion_gasolina?: string;
  conductor_id?: string;
  proyecto_id?: string;
};

export type ConsumoPromedio = {
  consumo_promedio_km: number;
  consumo_total: number;
  km_recorridos: number;
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
  id, vehiculo_id, maquinaria_id, conductor_id, entidad_id, proyecto_id, fecha, litros, cantidad_litros,
  odometro_km, km_actual, precio_litro_usd, precio_litro_bs, monto_usd, costo_total, monto_bs,
  estacion, estacion_gasolina, tipo_gasolina, factura_url, notas, created_by, created_at, updated_at,
  vehiculo:ci_flota_vehiculos!vehiculo_id (id, placa, marca, modelo),
  conductor:ci_flota_conductores!conductor_id (id, nombres, apellidos)
`;

const GASOLINA_SELECT_LEGACY = `
  id, vehiculo_id, conductor_id, entidad_id, proyecto_id, fecha, litros, odometro_km,
  precio_litro_usd, precio_litro_bs, monto_usd, monto_bs, estacion, factura_url, notas,
  created_at, updated_at,
  vehiculo:ci_flota_vehiculos!vehiculo_id (id, placa, marca, modelo),
  conductor:ci_flota_conductores!conductor_id (id, nombres, apellidos)
`;

function columnasNuevasFaltan(error: { message?: string } | null): boolean {
  return /maquinaria_id|cantidad_litros|costo_total|km_actual|tipo_gasolina|estacion_gasolina|created_by/i.test(
    error?.message ?? '',
  );
}

function unwrap(row: Record<string, unknown>): FlotaGasolina {
  const vehiculo = Array.isArray(row.vehiculo) ? row.vehiculo[0] : row.vehiculo;
  const conductor = Array.isArray(row.conductor) ? row.conductor[0] : row.conductor;
  const litros = Number(row.cantidad_litros ?? row.litros ?? 0);
  const odometro = parseNumero(row.km_actual ?? row.odometro_km);
  const costo = parseNumero(row.costo_total ?? row.monto_usd);
  const estacion = (row.estacion_gasolina as string | null) ?? (row.estacion as string | null) ?? null;
  return {
    ...(row as unknown as FlotaGasolina),
    vehiculo_id: String(row.vehiculo_id ?? row.maquinaria_id ?? ''),
    maquinaria_id: (row.maquinaria_id as string | null) ?? (row.vehiculo_id as string | null) ?? null,
    litros,
    cantidad_litros: litros,
    odometro_km: odometro,
    km_actual: odometro,
    monto_usd: costo,
    costo_total: costo,
    estacion,
    estacion_gasolina: estacion,
    vehiculo: vehiculo ?? null,
    conductor: conductor ?? null,
  };
}

const COLUMNAS_NUEVAS_GASOLINA = [
  'maquinaria_id',
  'cantidad_litros',
  'costo_total',
  'km_actual',
  'tipo_gasolina',
  'estacion_gasolina',
  'created_by',
] as const;

function payloadLegacy(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const k of COLUMNAS_NUEVAS_GASOLINA) delete out[k];
  return out;
}

function asGasolinaRows(data: unknown): Record<string, unknown>[] {
  return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
}

function asGasolinaRow(data: unknown): Record<string, unknown> | null {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

async function insertarCargaGasolina(body: Record<string, unknown>): Promise<FlotaGasolina> {
  const supabase = await createServerClient();
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const row = payload({ ...body, created_by: userId });

  let result = await supabase.from('ci_flota_gasolina').insert([row]).select(GASOLINA_SELECT).single();
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await supabase
      .from('ci_flota_gasolina')
      .insert([payloadLegacy(row)])
      .select(GASOLINA_SELECT_LEGACY)
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

  return unwrap(asGasolinaRow(result.data) ?? {});
}

export async function registrarGasolina(data: RegistrarGasolinaInput): Promise<FlotaGasolina> {
  if (!esUuid(data.maquinaria_id)) throw new Error('maquinaria_id requerido');
  if (data.cantidad_litros == null || Number(data.cantidad_litros) <= 0) {
    throw new Error('cantidad_litros debe ser mayor a 0');
  }
  if (data.costo_total == null || Number.isNaN(Number(data.costo_total))) {
    throw new Error('costo_total es requerido');
  }

  return insertarCargaGasolina({
    maquinaria_id: data.maquinaria_id,
    cantidad_litros: data.cantidad_litros,
    costo_total: data.costo_total,
    km_actual: data.km_actual,
    tipo_gasolina: data.tipo_gasolina,
    estacion_gasolina: data.estacion_gasolina,
    conductor_id: data.conductor_id,
    proyecto_id: data.proyecto_id,
  });
}

export async function obtenerGasolinaPorMaquinaria(maquinaria_id: string): Promise<FlotaGasolina[]> {
  if (!esUuid(maquinaria_id)) throw new Error('maquinaria_id requerido');
  const supabase = await createServerClient();

  const query = (col: 'maquinaria_id' | 'vehiculo_id', cols: string) =>
    supabase
      .from('ci_flota_gasolina')
      .select(cols)
      .eq(col, maquinaria_id)
      .order('created_at', { ascending: false });

  let result = await query('maquinaria_id', GASOLINA_SELECT);
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await query('vehiculo_id', GASOLINA_SELECT_LEGACY);
  }
  if (result.error) throw result.error;
  return asGasolinaRows(result.data).map(unwrap);
}

export async function calcularConsumoPromedio(
  maquinaria_id: string,
  ultimos_registros = 10,
): Promise<ConsumoPromedio> {
  if (!esUuid(maquinaria_id)) throw new Error('maquinaria_id requerido');
  const supabase = await createServerClient();

  const query = (col: 'maquinaria_id' | 'vehiculo_id', cols: string) =>
    supabase
      .from('ci_flota_gasolina')
      .select(cols)
      .eq(col, maquinaria_id)
      .order('created_at', { ascending: false })
      .limit(ultimos_registros);

  let result = await query(
    'maquinaria_id',
    'cantidad_litros, km_actual, litros, odometro_km, created_at',
  );
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await query('vehiculo_id', 'litros, odometro_km, created_at');
  }
  if (result.error) throw result.error;
  return calcularConsumoDesdeRegistros(asGasolinaRows(result.data));
}

function payload(body: Record<string, unknown>, partial = false): Record<string, unknown> {
  const vehiculoId = String(body.vehiculo_id ?? body.maquinaria_id ?? '').trim();
  if (!partial && !esUuid(vehiculoId)) throw new Error('maquinaria_id requerido');

  const litros = parseNumero(body.cantidad_litros ?? body.litros);
  if (!partial && (litros == null || litros <= 0)) throw new Error('cantidad_litros debe ser mayor a 0');

  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!partial || body.vehiculo_id !== undefined || body.maquinaria_id !== undefined) {
    out.vehiculo_id = vehiculoId;
    out.maquinaria_id = vehiculoId;
  }
  if (!partial || body.litros !== undefined || body.cantidad_litros !== undefined) {
    if (litros == null || litros <= 0) throw new Error('cantidad_litros debe ser mayor a 0');
    out.litros = litros;
    out.cantidad_litros = litros;
  }
  if (!partial || body.fecha !== undefined) out.fecha = parseFechaIso(body.fecha) ?? hoyIso();
  if (!partial || body.odometro_km !== undefined || body.km_actual !== undefined) {
    const km = parseNumero(body.km_actual ?? body.odometro_km);
    out.odometro_km = km;
    out.km_actual = km;
  }
  if (!partial || body.precio_litro_usd !== undefined) {
    out.precio_litro_usd = parseNumero(body.precio_litro_usd);
  }
  if (!partial || body.precio_litro_bs !== undefined) {
    out.precio_litro_bs = parseNumero(body.precio_litro_bs);
  }
  if (!partial || body.monto_usd !== undefined || body.costo_total !== undefined) {
    const costo = parseNumero(body.costo_total ?? body.monto_usd);
    out.monto_usd = costo;
    out.costo_total = costo;
  }
  if (!partial || body.monto_bs !== undefined) out.monto_bs = parseNumero(body.monto_bs);
  if (!partial || body.estacion !== undefined || body.estacion_gasolina !== undefined) {
    const est = String(body.estacion_gasolina ?? body.estacion ?? '').trim() || null;
    out.estacion = est;
    out.estacion_gasolina = est;
  }
  if (!partial || body.tipo_gasolina !== undefined) {
    out.tipo_gasolina = String(body.tipo_gasolina ?? '').trim() || null;
  }
  if (!partial || body.created_by !== undefined) {
    out.created_by = esUuid(String(body.created_by ?? '')) ? String(body.created_by) : null;
  }
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
    if (out.costo_total == null) out.costo_total = out.monto_usd;
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
  const ejecutar = async (cols: string) => {
    let q = supabase.from('ci_flota_gasolina').select(cols).order('fecha', { ascending: false });
    if (opts?.vehiculoId) q = q.eq('vehiculo_id', opts.vehiculoId);
    if (opts?.conductorId) q = q.eq('conductor_id', opts.conductorId);
    if (opts?.desde) q = q.gte('fecha', opts.desde);
    if (opts?.hasta) q = q.lte('fecha', opts.hasta);
    return q.limit(500);
  };

  let result = await ejecutar(GASOLINA_SELECT);
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await ejecutar(GASOLINA_SELECT_LEGACY);
  }
  if (esMigracionPendiente(result.error)) return { items: [], migracionPendiente: true };
  if (result.error) throw new Error(result.error.message);
  return { items: asGasolinaRows(result.data).map(unwrap), migracionPendiente: false };
}

export async function obtenerGasolina(
  supabase: SupabaseClient,
  id: string,
): Promise<{ item: FlotaGasolina | null; migracionPendiente: boolean }> {
  let result = await supabase
    .from('ci_flota_gasolina')
    .select(GASOLINA_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await supabase
      .from('ci_flota_gasolina')
      .select(GASOLINA_SELECT_LEGACY)
      .eq('id', id)
      .maybeSingle();
  }
  if (esMigracionPendiente(result.error)) return { item: null, migracionPendiente: true };
  if (result.error) throw new Error(result.error.message);
  const row = asGasolinaRow(result.data);
  return { item: row ? unwrap(row) : null, migracionPendiente: false };
}

export async function crearGasolina(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<FlotaGasolina> {
  void supabase;
  return insertarCargaGasolina(body);
}

export async function actualizarGasolina(
  supabase: SupabaseClient,
  id: string,
  body: Record<string, unknown>,
): Promise<FlotaGasolina> {
  const patch = payload(body, true);
  let result = await supabase
    .from('ci_flota_gasolina')
    .update(patch)
    .eq('id', id)
    .select(GASOLINA_SELECT)
    .single();
  if (result.error && columnasNuevasFaltan(result.error)) {
    result = await supabase
      .from('ci_flota_gasolina')
      .update(payloadLegacy(patch))
      .eq('id', id)
      .select(GASOLINA_SELECT_LEGACY)
      .single();
  }
  if (result.error) throw new Error(result.error.message);
  return unwrap(asGasolinaRow(result.data) ?? {});
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

  for (const [vehiculo_id, g] of Array.from(byVeh.entries())) {
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
