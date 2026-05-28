import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DESPACHO_ALERTAS_DEFAULT,
  type DespachoAlertasConfig,
} from '@/lib/almacen/despachoAlertasConfig';

export type InvDespachoAlertasRow = {
  ci_proyecto_id: string;
  exceso_advertencia_pct: number;
  exceso_critico_pct: number;
  saldo_informativo_pct: number;
  updated_at?: string;
};

export function rowToDespachoAlertasConfig(row: Partial<InvDespachoAlertasRow>): DespachoAlertasConfig {
  return {
    excesoAdvertenciaPct: Number(row.exceso_advertencia_pct ?? DESPACHO_ALERTAS_DEFAULT.excesoAdvertenciaPct),
    excesoCriticoPct: Number(row.exceso_critico_pct ?? DESPACHO_ALERTAS_DEFAULT.excesoCriticoPct),
    saldoInformativoPct: Number(row.saldo_informativo_pct ?? DESPACHO_ALERTAS_DEFAULT.saldoInformativoPct),
  };
}

export function configToRowPayload(
  proyectoId: string,
  config: DespachoAlertasConfig,
): Omit<InvDespachoAlertasRow, 'updated_at'> {
  return {
    ci_proyecto_id: proyectoId,
    exceso_advertencia_pct: config.excesoAdvertenciaPct,
    exceso_critico_pct: config.excesoCriticoPct,
    saldo_informativo_pct: config.saldoInformativoPct,
  };
}

export function normalizarDespachoAlertasConfig(
  input: Partial<DespachoAlertasConfig>,
): { config: DespachoAlertasConfig; error?: string } {
  const adv = Number(input.excesoAdvertenciaPct);
  const crit = Number(input.excesoCriticoPct);
  const saldo = Number(input.saldoInformativoPct);

  if (!Number.isFinite(adv) || adv <= 0 || adv > 500) {
    return { config: DESPACHO_ALERTAS_DEFAULT, error: 'Advertencia debe ser entre 0.1% y 500%.' };
  }
  if (!Number.isFinite(crit) || crit <= 0 || crit > 500) {
    return { config: DESPACHO_ALERTAS_DEFAULT, error: 'Crítico debe ser entre 0.1% y 500%.' };
  }
  if (crit < adv) {
    return {
      config: DESPACHO_ALERTAS_DEFAULT,
      error: 'El umbral crítico debe ser mayor o igual al de advertencia.',
    };
  }
  if (!Number.isFinite(saldo) || saldo < 0 || saldo > 100) {
    return { config: DESPACHO_ALERTAS_DEFAULT, error: 'Saldo informativo debe ser entre 0% y 100%.' };
  }

  return {
    config: {
      excesoAdvertenciaPct: Math.round(adv * 100) / 100,
      excesoCriticoPct: Math.round(crit * 100) / 100,
      saldoInformativoPct: Math.round(saldo * 100) / 100,
    },
  };
}

/** Lee umbrales del proyecto o devuelve valores por defecto si no hay fila. */
export async function cargarDespachoAlertasProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<{ config: DespachoAlertasConfig; personalizado: boolean; updatedAt?: string }> {
  const { data, error } = await supabase
    .from('inv_despacho_alertas_proyecto')
    .select('exceso_advertencia_pct, exceso_critico_pct, saldo_informativo_pct, updated_at')
    .eq('ci_proyecto_id', proyectoId)
    .maybeSingle();

  if (error?.code === '42P01') {
    return { config: { ...DESPACHO_ALERTAS_DEFAULT }, personalizado: false };
  }
  if (error) throw new Error(error.message);

  if (!data) {
    return { config: { ...DESPACHO_ALERTAS_DEFAULT }, personalizado: false };
  }

  return {
    config: rowToDespachoAlertasConfig(data as InvDespachoAlertasRow),
    personalizado: true,
    updatedAt: (data as { updated_at?: string }).updated_at,
  };
}

export async function guardarDespachoAlertasProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  config: DespachoAlertasConfig,
): Promise<DespachoAlertasConfig> {
  const norm = normalizarDespachoAlertasConfig(config);
  if (norm.error) throw new Error(norm.error);

  const payload = configToRowPayload(proyectoId, norm.config);
  const { error } = await supabase
    .from('inv_despacho_alertas_proyecto')
    .upsert(payload, { onConflict: 'ci_proyecto_id' });

  if (error?.code === '42P01') {
    throw new Error('Tabla de alertas no instalada. Aplique migración 184 en Supabase.');
  }
  if (error) throw new Error(error.message);

  return norm.config;
}
