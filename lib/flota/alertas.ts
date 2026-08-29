import type { SupabaseClient } from '@supabase/supabase-js';
import type { FlotaConductor, FlotaConductorDocumento } from '@/lib/flota/conductores';
import type { ConsumoPorVehiculo } from '@/lib/flota/gasolina';
import type { FlotaMantenimiento } from '@/lib/flota/mantenimiento';
import {
  TIPOS_ALERTA_CONFIG,
  diasHasta,
  esMigracionPendiente,
  etiquetaConductor,
  etiquetaVehiculo,
  fechaLicenciaConductor,
  fechaSaludConductor,
  parseNumero,
  type FlotaVehiculo,
  type TipoAlertaConfig,
} from '@/lib/flota/utils';

export type FlotaAlertaConfig = {
  id: string;
  tipo: TipoAlertaConfig;
  dias_anticipacion: number;
  umbral_consumo_km_l: number | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

export type FlotaAlerta = {
  id: string;
  tipo: string;
  severidad: 'info' | 'warning' | 'critica';
  titulo: string;
  mensaje: string | null;
  conductor_id: string | null;
  vehiculo_id: string | null;
  referencia_id: string | null;
  vence_el: string | null;
  leida: boolean;
  resuelta: boolean;
  created_at: string;
  updated_at: string;
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
  'id, tipo, dias_anticipacion, umbral_consumo_km_l, activa, created_at, updated_at';
const ALERTA_SELECT =
  'id, tipo, severidad, titulo, mensaje, conductor_id, vehiculo_id, referencia_id, vence_el, leida, resuelta, created_at, updated_at';

export const ETIQUETA_TIPO_ALERTA: Record<TipoAlertaConfig, string> = {
  licencia_vence: 'Licencia por vencer',
  certificado_vence: 'Certificado médico',
  documento_vence: 'Documento por vencer',
  mantenimiento_fecha: 'Mantenimiento por fecha',
  mantenimiento_km: 'Mantenimiento por km',
  consumo_alto: 'Consumo alto',
};

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
    for (const m of latestByVeh.values()) {
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
    for (const m of latestByVeh.values()) {
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

export async function listarConfigAlertas(
  supabase: SupabaseClient,
): Promise<{ items: FlotaAlertaConfig[]; migracionPendiente: boolean }> {
  const { data, error } = await supabase
    .from('ci_flota_alertas_config')
    .select(CONFIG_SELECT)
    .order('tipo');
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as FlotaAlertaConfig[], migracionPendiente: false };
}

export async function upsertConfigAlerta(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<FlotaAlertaConfig> {
  const tipoRaw = String(body.tipo ?? '');
  if (!(TIPOS_ALERTA_CONFIG as readonly string[]).includes(tipoRaw)) {
    throw new Error('tipo de alerta inválido');
  }
  const row = {
    tipo: tipoRaw,
    dias_anticipacion: Math.max(0, Math.round(parseNumero(body.dias_anticipacion) ?? 15)),
    umbral_consumo_km_l: parseNumero(body.umbral_consumo_km_l),
    activa: body.activa !== false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('ci_flota_alertas_config')
    .upsert(row, { onConflict: 'tipo' })
    .select(CONFIG_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as FlotaAlertaConfig;
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
  const { data, error } = await supabase
    .from('ci_flota_alertas_config')
    .update(patch)
    .eq('id', id)
    .select(CONFIG_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as FlotaAlertaConfig;
}

export async function listarAlertas(
  supabase: SupabaseClient,
  opts?: { soloAbiertas?: boolean },
): Promise<{ items: FlotaAlerta[]; migracionPendiente: boolean }> {
  let q = supabase.from('ci_flota_alertas').select(ALERTA_SELECT).order('created_at', { ascending: false });
  if (opts?.soloAbiertas !== false) q = q.eq('resuelta', false);
  const { data, error } = await q.limit(200);
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as FlotaAlerta[], migracionPendiente: false };
}

export async function actualizarAlerta(
  supabase: SupabaseClient,
  id: string,
  body: Record<string, unknown>,
): Promise<FlotaAlerta> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.leida !== undefined) patch.leida = Boolean(body.leida);
  if (body.resuelta !== undefined) patch.resuelta = Boolean(body.resuelta);
  const { data, error } = await supabase
    .from('ci_flota_alertas')
    .update(patch)
    .eq('id', id)
    .select(ALERTA_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as FlotaAlerta;
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

  const { data, error } = await supabase
    .from('ci_flota_alertas')
    .insert(
      nuevos.map((b) => ({
        tipo: b.tipo,
        severidad: b.severidad,
        titulo: b.titulo,
        mensaje: b.mensaje,
        conductor_id: b.conductor_id ?? null,
        vehiculo_id: b.vehiculo_id ?? null,
        referencia_id: b.referencia_id ?? null,
        vence_el: b.vence_el ?? null,
      })),
    )
    .select(ALERTA_SELECT);
  if (error) throw new Error(error.message);
  return (data ?? []) as FlotaAlerta[];
}
