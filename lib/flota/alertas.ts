import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import type { FlotaConductor, FlotaConductorDocumento } from '@/lib/flota/conductores';
import type { ConsumoPorVehiculo } from '@/lib/flota/gasolina';
import type { FlotaMantenimiento } from '@/lib/flota/mantenimiento';
import {
  ETIQUETA_TIPO_ALERTA,
  TIPOS_ALERTA_CONFIG,
  diasHasta,
  esMigracionPendiente,
  esUuid,
  estadoAlertaDesdeFlags,
  etiquetaConductor,
  etiquetaVehiculo,
  fechaLicenciaConductor,
  fechaSaludConductor,
  flagsDesdeEstadoAlerta,
  normalizarFrecuenciaAlerta,
  normalizarSeveridadAlerta,
  parseFechaIso,
  parseNumero,
  tipoAlertaACatalogo,
  type EstadoAlerta,
  type FrecuenciaAlerta,
  type FlotaVehiculo,
  type SeveridadAlerta,
  type TipoAlertaConfig,
} from '@/lib/flota/utils';

export type FlotaAlertaConfig = {
  id: string;
  tipo: TipoAlertaConfig;
  tipo_alerta?: string | null;
  maquinaria_id?: string | null;
  frecuencia_tipo?: FrecuenciaAlerta | null;
  frecuencia_valor?: number | null;
  proxima_alerta_km?: number | null;
  proxima_alerta_fecha?: string | null;
  dias_anticipacion: number;
  umbral_consumo_km_l: number | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

export type FlotaAlerta = {
  id: string;
  tipo: string;
  tipo_alerta?: string | null;
  severidad: SeveridadAlerta;
  titulo: string;
  mensaje: string | null;
  descripcion?: string | null;
  conductor_id: string | null;
  vehiculo_id: string | null;
  maquinaria_id?: string | null;
  config_id?: string | null;
  referencia_id: string | null;
  vence_el: string | null;
  fecha_vencimiento?: string | null;
  km_vencimiento?: number | null;
  estado?: EstadoAlerta;
  creada_en?: string | null;
  leida: boolean;
  resuelta: boolean;
  created_at: string;
  updated_at: string;
};

export type CrearConfiguracionAlertaInput = {
  maquinaria_id: string;
  tipo_alerta: string;
  frecuencia_tipo: FrecuenciaAlerta;
  frecuencia_valor: number;
  proxima_alerta_km?: number;
  proxima_alerta_fecha?: string;
};

export type GenerarAlertaInput = {
  config_id: string;
  maquinaria_id: string;
  tipo_alerta: string;
  descripcion?: string;
  severidad?: 'info' | 'warning' | 'critical' | 'critica';
  fecha_vencimiento?: string;
  km_vencimiento?: number;
};

export type AlertaBorrador = {
  tipo: string;
  severidad: FlotaAlerta['severidad'];
  titulo: string;
  mensaje: string;
  conductor_id?: string | null;
  vehiculo_id?: string | null;
  referencia_id?: string | null;
  vence_el?: string | null;
  clave: string;
};

const CONFIG_SELECT =
  'id, tipo, tipo_alerta, maquinaria_id, frecuencia_tipo, frecuencia_valor, proxima_alerta_km, proxima_alerta_fecha, dias_anticipacion, umbral_consumo_km_l, activa, created_at, updated_at';
const CONFIG_SELECT_LEGACY =
  'id, tipo, dias_anticipacion, umbral_consumo_km_l, activa, created_at, updated_at';
const ALERTA_SELECT =
  'id, tipo, tipo_alerta, severidad, titulo, mensaje, descripcion, conductor_id, vehiculo_id, maquinaria_id, config_id, referencia_id, vence_el, fecha_vencimiento, km_vencimiento, estado, creada_en, leida, resuelta, created_at, updated_at';
const ALERTA_SELECT_LEGACY =
  'id, tipo, severidad, titulo, mensaje, conductor_id, vehiculo_id, referencia_id, vence_el, leida, resuelta, created_at, updated_at';

const COLUMNAS_NUEVAS_CONFIG =
  /maquinaria_id|tipo_alerta|frecuencia_tipo|frecuencia_valor|proxima_alerta/i;
const COLUMNAS_NUEVAS_ALERTA =
  /config_id|maquinaria_id|tipo_alerta|descripcion|fecha_vencimiento|km_vencimiento|\bestado\b|creada_en/i;

function asRows(data: unknown): Record<string, unknown>[] {
  return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
}

function asRow(data: unknown): Record<string, unknown> | null {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

function unwrapConfig(row: Record<string, unknown>): FlotaAlertaConfig {
  const tipoAlerta = String(row.tipo_alerta ?? row.tipo ?? '');
  const frecuencia =
    row.frecuencia_tipo === 'km' || row.frecuencia_tipo === 'dias'
      ? (row.frecuencia_tipo as FrecuenciaAlerta)
      : tipoAlerta === 'mantenimiento_km'
        ? 'km'
        : 'dias';
  const valor = parseNumero(row.frecuencia_valor) ?? Number(row.dias_anticipacion ?? 0);
  return {
    ...(row as unknown as FlotaAlertaConfig),
    tipo: tipoAlertaACatalogo(String(row.tipo ?? tipoAlerta), frecuencia),
    tipo_alerta: tipoAlerta || null,
    maquinaria_id: (row.maquinaria_id as string | null) ?? null,
    frecuencia_tipo: frecuencia,
    frecuencia_valor: valor,
    proxima_alerta_km: parseNumero(row.proxima_alerta_km),
    proxima_alerta_fecha: parseFechaIso(row.proxima_alerta_fecha),
    dias_anticipacion: Number(row.dias_anticipacion ?? (frecuencia === 'dias' ? valor : 0)),
    umbral_consumo_km_l: parseNumero(row.umbral_consumo_km_l),
    activa: row.activa !== false,
  };
}

function unwrapAlerta(row: Record<string, unknown>): FlotaAlerta {
  const leida = Boolean(row.leida);
  const resuelta = Boolean(row.resuelta);
  const estado =
    (row.estado as EstadoAlerta | undefined) ?? estadoAlertaDesdeFlags(leida, resuelta);
  const flags = flagsDesdeEstadoAlerta(estado);
  const vence = parseFechaIso(row.fecha_vencimiento ?? row.vence_el);
  const mensaje = (row.descripcion as string | null) ?? (row.mensaje as string | null) ?? null;
  const vehiculoId = (row.vehiculo_id as string | null) ?? (row.maquinaria_id as string | null) ?? null;
  return {
    ...(row as unknown as FlotaAlerta),
    tipo: String(row.tipo_alerta ?? row.tipo ?? ''),
    tipo_alerta: String(row.tipo_alerta ?? row.tipo ?? '') || null,
    severidad: normalizarSeveridadAlerta(row.severidad),
    titulo: String(row.titulo ?? row.tipo_alerta ?? 'Alerta'),
    mensaje,
    descripcion: mensaje,
    vehiculo_id: vehiculoId,
    maquinaria_id: (row.maquinaria_id as string | null) ?? vehiculoId,
    config_id: (row.config_id as string | null) ?? (row.referencia_id as string | null) ?? null,
    vence_el: vence,
    fecha_vencimiento: vence,
    km_vencimiento: parseNumero(row.km_vencimiento),
    estado,
    creada_en: (row.creada_en as string | null) ?? (row.created_at as string | null) ?? null,
    leida: flags.leida || leida,
    resuelta: flags.resuelta || resuelta,
  };
}

function payloadConfigMaquinaria(data: CrearConfiguracionAlertaInput): Record<string, unknown> {
  const frecuencia = normalizarFrecuenciaAlerta(data.frecuencia_tipo);
  const valor = Number(data.frecuencia_valor);
  if (!Number.isFinite(valor) || valor < 0) throw new Error('frecuencia_valor inválido');
  const tipoAlerta = String(data.tipo_alerta ?? '').trim();
  if (!tipoAlerta) throw new Error('tipo_alerta requerido');
  const tipo = tipoAlertaACatalogo(tipoAlerta, frecuencia);
  return {
    maquinaria_id: data.maquinaria_id,
    tipo,
    tipo_alerta: tipoAlerta,
    frecuencia_tipo: frecuencia,
    frecuencia_valor: valor,
    dias_anticipacion: frecuencia === 'dias' ? Math.round(valor) : 0,
    proxima_alerta_km: parseNumero(data.proxima_alerta_km),
    proxima_alerta_fecha: parseFechaIso(data.proxima_alerta_fecha),
    activa: true,
    updated_at: new Date().toISOString(),
  };
}

function payloadAlertaGenerada(data: GenerarAlertaInput): Record<string, unknown> {
  const tipoAlerta = String(data.tipo_alerta ?? '').trim();
  if (!tipoAlerta) throw new Error('tipo_alerta requerido');
  const descripcion = String(data.descripcion ?? '').trim() || null;
  const severidad = normalizarSeveridadAlerta(data.severidad ?? 'warning');
  const flags = flagsDesdeEstadoAlerta('pendiente');
  const vence = parseFechaIso(data.fecha_vencimiento);
  return {
    config_id: data.config_id,
    referencia_id: esUuid(data.config_id) ? data.config_id : null,
    maquinaria_id: data.maquinaria_id,
    vehiculo_id: data.maquinaria_id,
    tipo: tipoAlertaACatalogo(tipoAlerta),
    tipo_alerta: tipoAlerta,
    titulo: descripcion || tipoAlerta,
    mensaje: descripcion,
    descripcion,
    severidad,
    fecha_vencimiento: vence,
    vence_el: vence,
    km_vencimiento: parseNumero(data.km_vencimiento),
    estado: 'pendiente',
    creada_en: new Date().toISOString(),
    leida: flags.leida,
    resuelta: flags.resuelta,
    updated_at: new Date().toISOString(),
  };
}

const COLUMNAS_NUEVAS_CONFIG_KEYS = [
  'maquinaria_id',
  'tipo_alerta',
  'frecuencia_tipo',
  'frecuencia_valor',
  'proxima_alerta_km',
  'proxima_alerta_fecha',
] as const;

const COLUMNAS_NUEVAS_ALERTA_KEYS = [
  'config_id',
  'maquinaria_id',
  'tipo_alerta',
  'descripcion',
  'fecha_vencimiento',
  'km_vencimiento',
  'estado',
  'creada_en',
] as const;

function sinColumnas<T extends string>(row: Record<string, unknown>, keys: readonly T[]): Record<string, unknown> {
  const out = { ...row };
  for (const k of keys) delete out[k];
  return out;
}

export { ETIQUETA_TIPO_ALERTA };

function configMap(configs: FlotaAlertaConfig[]): Map<TipoAlertaConfig, FlotaAlertaConfig> {
  return new Map(configs.filter((c) => c.activa).map((c) => [c.tipo, c]));
}

export function evaluarAlertas(input: {
  conductores: FlotaConductor[];
  documentos: FlotaConductorDocumento[];
  vehiculos: FlotaVehiculo[];
  mantenimientos: FlotaMantenimiento[];
  consumos: ConsumoPorVehiculo[];
  configs: FlotaAlertaConfig[];
  now?: Date;
}): AlertaBorrador[] {
  const now = input.now ?? new Date();
  const cfg = configMap(input.configs);
  const out: AlertaBorrador[] = [];

  const lic = cfg.get('licencia_vence');
  if (lic) {
    for (const c of input.conductores.filter((x) => x.activo)) {
      const dias = diasHasta(fechaLicenciaConductor(c), now);
      if (dias == null) continue;
      if (dias > lic.dias_anticipacion) continue;
      out.push({
        tipo: 'licencia_vence',
        severidad: dias < 0 ? 'critica' : dias <= 7 ? 'warning' : 'info',
        titulo: dias < 0 ? 'Licencia vencida' : 'Licencia por vencer',
        mensaje: `${etiquetaConductor(c)}: licencia ${dias < 0 ? `vencida hace ${Math.abs(dias)} día(s)` : `vence en ${dias} día(s)`}.`,
        conductor_id: c.id,
        vehiculo_id: c.vehiculo_asignado_id,
        vence_el: fechaLicenciaConductor(c),
        clave: `licencia:${c.id}:${fechaLicenciaConductor(c)}`,
      });
    }
  }

  const cert = cfg.get('certificado_vence');
  if (cert) {
    for (const c of input.conductores.filter((x) => x.activo)) {
      const dias = diasHasta(fechaSaludConductor(c), now);
      if (dias == null || dias > cert.dias_anticipacion) continue;
      out.push({
        tipo: 'certificado_vence',
        severidad: dias < 0 ? 'critica' : 'warning',
        titulo: dias < 0 ? 'Certificado médico vencido' : 'Certificado médico por vencer',
        mensaje: `${etiquetaConductor(c)}: certificado ${dias < 0 ? `vencido hace ${Math.abs(dias)} día(s)` : `vence en ${dias} día(s)`}.`,
        conductor_id: c.id,
        vehiculo_id: c.vehiculo_asignado_id,
        vence_el: fechaSaludConductor(c),
        clave: `cert:${c.id}:${fechaSaludConductor(c)}`,
      });
    }
  }

  const docCfg = cfg.get('documento_vence');
  if (docCfg) {
    for (const d of input.documentos) {
      const dias = diasHasta(d.vence_el, now);
      if (dias == null || dias > docCfg.dias_anticipacion) continue;
      const cond = input.conductores.find((c) => c.id === d.conductor_id);
      out.push({
        tipo: 'documento_vence',
        severidad: dias < 0 ? 'critica' : 'warning',
        titulo: dias < 0 ? 'Documento vencido' : 'Documento por vencer',
        mensaje: `${d.nombre} de ${cond ? etiquetaConductor(cond) : 'conductor'}: ${dias < 0 ? `vencido hace ${Math.abs(dias)} día(s)` : `vence en ${dias} día(s)`}.`,
        conductor_id: d.conductor_id,
        referencia_id: d.id,
        vence_el: d.vence_el,
        clave: `doc:${d.id}:${d.vence_el}`,
      });
    }
  }

  const mantF = cfg.get('mantenimiento_fecha');
  if (mantF) {
    const latestByVeh = new Map<string, FlotaMantenimiento>();
    for (const m of input.mantenimientos) {
      if (!m.proximo_fecha) continue;
      const prev = latestByVeh.get(m.vehiculo_id);
      if (!prev || (prev.proximo_fecha ?? '') < m.proximo_fecha) latestByVeh.set(m.vehiculo_id, m);
    }
    for (const m of Array.from(latestByVeh.values())) {
      const dias = diasHasta(m.proximo_fecha, now);
      if (dias == null || dias > mantF.dias_anticipacion) continue;
      out.push({
        tipo: 'mantenimiento_fecha',
        severidad: dias < 0 ? 'critica' : 'warning',
        titulo: dias < 0 ? 'Mantenimiento atrasado' : 'Mantenimiento próximo',
        mensaje: `${etiquetaVehiculo(m.vehiculo ?? {})}: ${dias < 0 ? `venció hace ${Math.abs(dias)} día(s)` : `en ${dias} día(s)`}.`,
        vehiculo_id: m.vehiculo_id,
        referencia_id: m.id,
        vence_el: m.proximo_fecha,
        clave: `mantf:${m.vehiculo_id}:${m.proximo_fecha}`,
      });
    }
  }

  const mantK = cfg.get('mantenimiento_km');
  if (mantK) {
    const latestByVeh = new Map<string, FlotaMantenimiento>();
    for (const m of input.mantenimientos) {
      if (m.proximo_odometro_km == null) continue;
      const prev = latestByVeh.get(m.vehiculo_id);
      if (!prev || (prev.fecha ?? '') < m.fecha) latestByVeh.set(m.vehiculo_id, m);
    }
    const vehById = new Map(input.vehiculos.map((v) => [v.id, v]));
    for (const m of Array.from(latestByVeh.values())) {
      const v = vehById.get(m.vehiculo_id);
      if (!v || m.proximo_odometro_km == null) continue;
      const resto = m.proximo_odometro_km - Number(v.odometro_km ?? 0);
      if (resto > 200) continue;
      out.push({
        tipo: 'mantenimiento_km',
        severidad: resto <= 0 ? 'critica' : 'warning',
        titulo: resto <= 0 ? 'Kilometraje de servicio superado' : 'Servicio próximo por km',
        mensaje: `${etiquetaVehiculo(v)}: ${resto <= 0 ? `pasó ${Math.abs(resto)} km del servicio` : `faltan ${Math.round(resto)} km`}.`,
        vehiculo_id: m.vehiculo_id,
        referencia_id: m.id,
        clave: `mantk:${m.vehiculo_id}:${m.proximo_odometro_km}`,
      });
    }
  }

  const cons = cfg.get('consumo_alto');
  if (cons?.umbral_consumo_km_l) {
    for (const c of input.consumos) {
      if (c.km_por_litro == null) continue;
      if (c.km_por_litro >= cons.umbral_consumo_km_l) continue;
      out.push({
        tipo: 'consumo_alto',
        severidad: 'warning',
        titulo: 'Consumo elevado de gasolina',
        mensaje: `${c.etiqueta}: ${c.km_por_litro} km/l (umbral ${cons.umbral_consumo_km_l} km/l).`,
        vehiculo_id: c.vehiculo_id,
        clave: `cons:${c.vehiculo_id}:${c.km_por_litro}`,
      });
    }
  }

  return out;
}

export async function crearConfiguracionAlerta(
  input: CrearConfiguracionAlertaInput,
): Promise<FlotaAlertaConfig> {
  if (!esUuid(input.maquinaria_id)) throw new Error('maquinaria_id requerido');
  const supabase = await createServerClient();
  const row = payloadConfigMaquinaria(input);

  let saved: unknown;
  let error: { message?: string } | null;
  const first = await supabase.from('ci_flota_alertas_config').insert([row]).select(CONFIG_SELECT).single();
  saved = first.data;
  error = first.error;
  if (error && COLUMNAS_NUEVAS_CONFIG.test(error.message ?? '')) {
    const retry = await supabase
      .from('ci_flota_alertas_config')
      .insert([sinColumnas(row, COLUMNAS_NUEVAS_CONFIG_KEYS)])
      .select(CONFIG_SELECT_LEGACY)
      .single();
    saved = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return unwrapConfig(asRow(saved) ?? {});
}

export async function generarAlerta(input: GenerarAlertaInput): Promise<FlotaAlerta> {
  if (!esUuid(input.config_id)) throw new Error('config_id requerido');
  if (!esUuid(input.maquinaria_id)) throw new Error('maquinaria_id requerido');
  const supabase = await createServerClient();
  const row = payloadAlertaGenerada(input);

  let saved: unknown;
  let error: { message?: string } | null;
  const first = await supabase.from('ci_flota_alertas').insert([row]).select(ALERTA_SELECT).single();
  saved = first.data;
  error = first.error;
  if (error && COLUMNAS_NUEVAS_ALERTA.test(error.message ?? '')) {
    const retry = await supabase
      .from('ci_flota_alertas')
      .insert([sinColumnas(row, COLUMNAS_NUEVAS_ALERTA_KEYS)])
      .select(ALERTA_SELECT_LEGACY)
      .single();
    saved = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return unwrapAlerta(asRow(saved) ?? {});
}

export type ConfigParaVerificar = {
  frecuencia_tipo?: string | null;
  proxima_alerta_fecha?: string | null;
  proxima_alerta_km?: number | null;
  activa?: boolean;
  activo?: boolean;
};

/** Fecha vencida o km actual ≥ umbral. Sin odómetro no alerta por km. */
export function checkShouldAlert(
  config: ConfigParaVerificar,
  opts?: { hoy?: Date; km_actual?: number | null },
): boolean {
  if (config.activa === false || config.activo === false) return false;
  const hoy = opts?.hoy ?? new Date();
  const tipo = String(config.frecuencia_tipo ?? '').toLowerCase();

  if ((tipo === 'dias' || tipo === 'días' || tipo === 'days') && config.proxima_alerta_fecha) {
    const dias = diasHasta(config.proxima_alerta_fecha, hoy);
    return dias != null && dias <= 0;
  }

  if (tipo === 'km' && config.proxima_alerta_km != null) {
    const umbral = Number(config.proxima_alerta_km);
    const km = opts?.km_actual;
    if (!Number.isFinite(umbral) || km == null || !Number.isFinite(km)) return false;
    return km >= umbral;
  }

  return false;
}

function descripcionAlertaConfig(
  config: FlotaAlertaConfig,
  kmActual: number | null,
): string {
  const tipo = config.tipo_alerta ?? config.tipo;
  if (config.frecuencia_tipo === 'km') {
    return `Alerta de ${tipo}: umbral ${config.proxima_alerta_km ?? config.frecuencia_valor} km${
      kmActual != null ? ` (odómetro ${kmActual} km)` : ''
    }`;
  }
  if (config.proxima_alerta_fecha) {
    return `Alerta de ${tipo}: vencía el ${config.proxima_alerta_fecha}`;
  }
  return `Alerta de ${tipo}: próxima en ${config.frecuencia_valor} ${config.frecuencia_tipo}`;
}

function clavePendiente(configId: string | null | undefined, maquinariaId: string | null | undefined): string {
  return `${configId ?? ''}:${maquinariaId ?? ''}`;
}

async function kmActualPorMaquinaria(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  ids: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const { data, error } = await supabase
    .from('ci_flota_vehiculos')
    .select('id, odometro_km')
    .in('id', ids);
  if (error) throw error;
  for (const row of asRows(data)) {
    const id = String(row.id ?? '');
    const km = parseNumero(row.odometro_km);
    if (esUuid(id) && km != null) out.set(id, km);
  }
  return out;
}

async function clavesAlertasPendientes(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<Set<string>> {
  let data: unknown;
  let error: { message?: string } | null;
  const first = await supabase
    .from('ci_flota_alertas')
    .select('config_id, maquinaria_id, vehiculo_id, estado, resuelta')
    .eq('estado', 'pendiente');
  data = first.data;
  error = first.error;
  if (error && COLUMNAS_NUEVAS_ALERTA.test(error.message ?? '')) {
    const retry = await supabase
      .from('ci_flota_alertas')
      .select('referencia_id, vehiculo_id, resuelta')
      .eq('resuelta', false);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  const set = new Set<string>();
  for (const row of asRows(data)) {
    if (row.resuelta) continue;
    const configId = String(row.config_id ?? row.referencia_id ?? '');
    const maq = String(row.maquinaria_id ?? row.vehiculo_id ?? '');
    set.add(clavePendiente(configId, maq));
  }
  return set;
}

export async function verificarYGenerarAlertas(opts?: { hoy?: Date }): Promise<{
  verificadas: number;
  creadas: FlotaAlerta[];
}> {
  const supabase = await createServerClient();
  const hoy = opts?.hoy ?? new Date();

  let configsRaw: unknown;
  let configsError: { message?: string } | null;
  const first = await supabase.from('ci_flota_alertas_config').select('*').eq('activa', true);
  configsRaw = first.data;
  configsError = first.error;
  if (configsError && /activa|column/i.test(configsError.message ?? '')) {
    const retry = await supabase.from('ci_flota_alertas_config').select('*').eq('activo', true);
    configsRaw = retry.data;
    configsError = retry.error;
  }
  if (configsError && COLUMNAS_NUEVAS_CONFIG.test(configsError.message ?? '')) {
    const retry = await supabase.from('ci_flota_alertas_config').select(CONFIG_SELECT_LEGACY).eq('activa', true);
    configsRaw = retry.data;
    configsError = retry.error;
  }
  if (configsError) throw configsError;
  if (!configsRaw) return { verificadas: 0, creadas: [] };

  const configs = asRows(configsRaw)
    .map(unwrapConfig)
    .filter((c) => c.activa !== false);
  const maqIds = Array.from(
    new Set(configs.map((c) => c.maquinaria_id).filter((id): id is string => Boolean(id && esUuid(id)))),
  );
  const [kmByMaq, pendientes] = await Promise.all([
    kmActualPorMaquinaria(supabase, maqIds),
    clavesAlertasPendientes(supabase),
  ]);

  const creadas: FlotaAlerta[] = [];
  for (const config of configs) {
    if (!config.maquinaria_id || !esUuid(config.maquinaria_id)) continue;
    const km_actual = kmByMaq.get(config.maquinaria_id) ?? null;
    if (!checkShouldAlert(config, { hoy, km_actual })) continue;

    const clave = clavePendiente(config.id, config.maquinaria_id);
    if (pendientes.has(clave)) continue;

    const tipoAlerta = String(config.tipo_alerta ?? config.tipo);
    const alerta = await generarAlerta({
      config_id: config.id,
      maquinaria_id: config.maquinaria_id,
      tipo_alerta: tipoAlerta,
      descripcion: descripcionAlertaConfig(config, km_actual),
      severidad: tipoAlerta === 'cambio_aceite' ? 'warning' : 'info',
      fecha_vencimiento: config.proxima_alerta_fecha ?? undefined,
      km_vencimiento: config.proxima_alerta_km ?? undefined,
    });
    creadas.push(alerta);
    pendientes.add(clave);
  }

  console.log('✅ Alertas verificadas');
  return { verificadas: configs.length, creadas };
}

export async function obtenerAlertasPendientes(): Promise<FlotaAlerta[]> {
  const supabase = await createServerClient();

  let data: unknown;
  let error: { message?: string } | null;
  const first = await supabase
    .from('ci_flota_alertas')
    .select(ALERTA_SELECT)
    .eq('estado', 'pendiente')
    .order('creada_en', { ascending: false });
  data = first.data;
  error = first.error;
  if (error && COLUMNAS_NUEVAS_ALERTA.test(error.message ?? '')) {
    const retry = await supabase
      .from('ci_flota_alertas')
      .select(ALERTA_SELECT_LEGACY)
      .eq('resuelta', false)
      .order('created_at', { ascending: false });
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return asRows(data).map(unwrapAlerta);
}

export async function listarConfigAlertas(
  supabase: SupabaseClient,
): Promise<{ items: FlotaAlertaConfig[]; migracionPendiente: boolean }> {
  let data: unknown;
  let error: { message?: string; code?: string } | null;
  const first = await supabase.from('ci_flota_alertas_config').select(CONFIG_SELECT).order('tipo');
  data = first.data;
  error = first.error;
  if (error && COLUMNAS_NUEVAS_CONFIG.test(error.message ?? '')) {
    const retry = await supabase.from('ci_flota_alertas_config').select(CONFIG_SELECT_LEGACY).order('tipo');
    data = retry.data;
    error = retry.error;
  }
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);
  const items = asRows(data)
    .map(unwrapConfig)
    .filter((c) => !c.maquinaria_id);
  return { items, migracionPendiente: false };
}

export async function upsertConfigAlerta(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<FlotaAlertaConfig> {
  const tipoRaw = String(body.tipo ?? body.tipo_alerta ?? '');
  if (!(TIPOS_ALERTA_CONFIG as readonly string[]).includes(tipoRaw)) {
    throw new Error('tipo de alerta inválido');
  }
  const row = {
    tipo: tipoRaw,
    tipo_alerta: tipoRaw,
    dias_anticipacion: Math.max(0, Math.round(parseNumero(body.dias_anticipacion) ?? 15)),
    umbral_consumo_km_l: parseNumero(body.umbral_consumo_km_l),
    activa: body.activa !== false,
    updated_at: new Date().toISOString(),
  };

  const buscar = async (cols: string) => {
    let q = supabase.from('ci_flota_alertas_config').select(cols).eq('tipo', tipoRaw);
    if (cols === CONFIG_SELECT) q = q.is('maquinaria_id', null);
    return q.maybeSingle();
  };

  let existingData: unknown;
  let existingError: { message?: string } | null;
  const existing = await buscar(CONFIG_SELECT);
  existingData = existing.data;
  existingError = existing.error;
  if (existingError && COLUMNAS_NUEVAS_CONFIG.test(existingError.message ?? '')) {
    const retry = await buscar(CONFIG_SELECT_LEGACY);
    existingData = retry.data;
    existingError = retry.error;
  }
  if (existingError) throw new Error(existingError.message);

  const existingRow = asRow(existingData);
  if (existingRow) {
    const id = String(existingRow.id ?? '');
    let data: unknown;
    let error: { message?: string } | null;
    const upd = await supabase
      .from('ci_flota_alertas_config')
      .update(row)
      .eq('id', id)
      .select(CONFIG_SELECT)
      .single();
    data = upd.data;
    error = upd.error;
    if (error && COLUMNAS_NUEVAS_CONFIG.test(error.message ?? '')) {
      const retry = await supabase
        .from('ci_flota_alertas_config')
        .update(sinColumnas(row, COLUMNAS_NUEVAS_CONFIG_KEYS))
        .eq('id', id)
        .select(CONFIG_SELECT_LEGACY)
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    return unwrapConfig(asRow(data) ?? {});
  }

  let data: unknown;
  let error: { message?: string } | null;
  const ins = await supabase.from('ci_flota_alertas_config').insert([row]).select(CONFIG_SELECT).single();
  data = ins.data;
  error = ins.error;
  if (error && COLUMNAS_NUEVAS_CONFIG.test(error.message ?? '')) {
    const retry = await supabase
      .from('ci_flota_alertas_config')
      .insert([sinColumnas(row, COLUMNAS_NUEVAS_CONFIG_KEYS)])
      .select(CONFIG_SELECT_LEGACY)
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  return unwrapConfig(asRow(data) ?? {});
}

export async function actualizarConfigAlerta(
  supabase: SupabaseClient,
  id: string,
  body: Record<string, unknown>,
): Promise<FlotaAlertaConfig> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.dias_anticipacion !== undefined) {
    patch.dias_anticipacion = Math.max(0, Math.round(parseNumero(body.dias_anticipacion) ?? 0));
  }
  if (body.umbral_consumo_km_l !== undefined) {
    patch.umbral_consumo_km_l = parseNumero(body.umbral_consumo_km_l);
  }
  if (body.activa !== undefined) patch.activa = Boolean(body.activa);
  let data: unknown;
  let error: { message?: string } | null;
  const first = await supabase
    .from('ci_flota_alertas_config')
    .update(patch)
    .eq('id', id)
    .select(CONFIG_SELECT)
    .single();
  data = first.data;
  error = first.error;
  if (error && COLUMNAS_NUEVAS_CONFIG.test(error.message ?? '')) {
    const retry = await supabase
      .from('ci_flota_alertas_config')
      .update(patch)
      .eq('id', id)
      .select(CONFIG_SELECT_LEGACY)
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  return unwrapConfig(asRow(data) ?? {});
}

export async function listarAlertas(
  supabase: SupabaseClient,
  opts?: { soloAbiertas?: boolean },
): Promise<{ items: FlotaAlerta[]; migracionPendiente: boolean }> {
  const ejecutar = async (cols: string, orden: 'creada_en' | 'created_at') => {
    let q = supabase.from('ci_flota_alertas').select(cols).order(orden, { ascending: false });
    if (opts?.soloAbiertas !== false) q = q.eq('resuelta', false);
    return q.limit(200);
  };

  let data: unknown;
  let error: { message?: string; code?: string } | null;
  const first = await ejecutar(ALERTA_SELECT, 'creada_en');
  data = first.data;
  error = first.error;
  if (error && COLUMNAS_NUEVAS_ALERTA.test(error.message ?? '')) {
    const retry = await ejecutar(ALERTA_SELECT_LEGACY, 'created_at');
    data = retry.data;
    error = retry.error;
  }
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { items: asRows(data).map(unwrapAlerta), migracionPendiente: false };
}

export async function actualizarAlerta(
  supabase: SupabaseClient,
  id: string,
  body: Record<string, unknown>,
): Promise<FlotaAlerta> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.estado !== undefined) {
    const flags = flagsDesdeEstadoAlerta(String(body.estado));
    patch.estado = estadoAlertaDesdeFlags(flags.leida, flags.resuelta);
    patch.leida = flags.leida;
    patch.resuelta = flags.resuelta;
  }
  if (body.leida !== undefined) patch.leida = Boolean(body.leida);
  if (body.resuelta !== undefined) patch.resuelta = Boolean(body.resuelta);
  if (body.leida !== undefined || body.resuelta !== undefined) {
    patch.estado = estadoAlertaDesdeFlags(Boolean(patch.leida), Boolean(patch.resuelta));
  }

  let data: unknown;
  let error: { message?: string } | null;
  const first = await supabase
    .from('ci_flota_alertas')
    .update(patch)
    .eq('id', id)
    .select(ALERTA_SELECT)
    .single();
  data = first.data;
  error = first.error;
  if (error && COLUMNAS_NUEVAS_ALERTA.test(error.message ?? '')) {
    const retry = await supabase
      .from('ci_flota_alertas')
      .update(sinColumnas(patch, COLUMNAS_NUEVAS_ALERTA_KEYS))
      .eq('id', id)
      .select(ALERTA_SELECT_LEGACY)
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  return unwrapAlerta(asRow(data) ?? {});
}

export async function eliminarAlerta(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('ci_flota_alertas').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function persistirAlertasGeneradas(
  supabase: SupabaseClient,
  borradores: AlertaBorrador[],
): Promise<FlotaAlerta[]> {
  if (!borradores.length) return [];

  const abiertas = await listarAlertas(supabase, { soloAbiertas: true });
  if (abiertas.migracionPendiente) return [];

  const existentes = new Set(
    abiertas.items.map(
      (a) => `${a.tipo}:${a.conductor_id ?? ''}:${a.vehiculo_id ?? ''}:${a.referencia_id ?? ''}:${a.vence_el ?? ''}`,
    ),
  );

  const nuevos = borradores.filter((b) => {
    const k = `${b.tipo}:${b.conductor_id ?? ''}:${b.vehiculo_id ?? ''}:${b.referencia_id ?? ''}:${b.vence_el ?? ''}`;
    return !existentes.has(k);
  });
  if (!nuevos.length) return [];

  const ahora = new Date().toISOString();
  const filas = nuevos.map((b) => ({
    tipo: b.tipo,
    tipo_alerta: b.tipo,
    severidad: b.severidad,
    titulo: b.titulo,
    mensaje: b.mensaje,
    descripcion: b.mensaje,
    conductor_id: b.conductor_id ?? null,
    vehiculo_id: b.vehiculo_id ?? null,
    maquinaria_id: b.vehiculo_id ?? null,
    referencia_id: b.referencia_id ?? null,
    vence_el: b.vence_el ?? null,
    fecha_vencimiento: b.vence_el ?? null,
    estado: 'pendiente',
    creada_en: ahora,
    leida: false,
    resuelta: false,
  }));

  let data: unknown;
  let error: { message?: string } | null;
  const first = await supabase.from('ci_flota_alertas').insert(filas).select(ALERTA_SELECT);
  data = first.data;
  error = first.error;
  if (error && COLUMNAS_NUEVAS_ALERTA.test(error.message ?? '')) {
    const retry = await supabase
      .from('ci_flota_alertas')
      .insert(filas.map((f) => sinColumnas(f, COLUMNAS_NUEVAS_ALERTA_KEYS)))
      .select(ALERTA_SELECT_LEGACY);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  return asRows(data).map(unwrapAlerta);
}
