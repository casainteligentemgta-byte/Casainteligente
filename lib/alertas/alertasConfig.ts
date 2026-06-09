import type { SupabaseClient } from '@supabase/supabase-js';
import { LIMITE_FAST_TRACK_USD_DEFAULT } from '@/lib/canal/limiteFastTrackUsd';
import { DESPACHO_ALERTAS_DEFAULT } from '@/lib/almacen/despachoAlertasConfig';
import type { UmbralesFechaCompra } from '@/lib/contabilidad/auditoriaFechaCompra';

export type AlertasConfigTelegram = {
  /** Override de TELEGRAM_ADMIN_CHANNEL_ID; null = usar variable de entorno. */
  canalAdminId: string | null;
};

export type AlertasConfigProcuras = {
  estadosAlertar: string[];
  palabrasPrioridadAlta: string[];
  palabrasPrioridadMedia: string[];
};

export type AlertasConfigCompras = {
  umbralAdvertenciaDias: number;
  umbralCriticoDias: number;
  umbralFuturoCriticoDias: number;
};

export type AlertasConfigFastTrack = {
  limiteUsdDefault: number;
  umbralConfianzaOcrPct: number;
};

export type AlertasConfigDespacho = {
  excesoAdvertenciaPct: number;
  excesoCriticoPct: number;
  saldoInformativoPct: number;
};

export type AlertasConfig = {
  telegram: AlertasConfigTelegram;
  procuras: AlertasConfigProcuras;
  compras: AlertasConfigCompras;
  fastTrack: AlertasConfigFastTrack;
  despacho: AlertasConfigDespacho;
};

export const ALERTAS_CONFIG_DEFAULT: AlertasConfig = {
  telegram: { canalAdminId: null },
  procuras: {
    estadosAlertar: ['solicitada'],
    palabrasPrioridadAlta: ['urgent', 'urgente', 'crit', 'critico', 'crítico'],
    palabrasPrioridadMedia: ['prioridad', 'importante'],
  },
  compras: {
    umbralAdvertenciaDias: 90,
    umbralCriticoDias: 365,
    umbralFuturoCriticoDias: 7,
  },
  fastTrack: {
    limiteUsdDefault: LIMITE_FAST_TRACK_USD_DEFAULT,
    umbralConfianzaOcrPct: 95,
  },
  despacho: { ...DESPACHO_ALERTAS_DEFAULT },
};

type RawJson = Record<string, unknown>;

function num(v: unknown, fallback: number, min = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

function strList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v.map((x) => String(x ?? '').trim().toLowerCase()).filter(Boolean);
  return out.length ? out : fallback;
}

function parseConfigJson(raw: RawJson | null | undefined): AlertasConfig {
  const d = ALERTAS_CONFIG_DEFAULT;
  const tg = (raw?.telegram as RawJson | undefined) ?? {};
  const pr = (raw?.procuras as RawJson | undefined) ?? {};
  const co = (raw?.compras as RawJson | undefined) ?? {};
  const ft = (raw?.fast_track as RawJson | undefined) ?? {};
  const de = (raw?.despacho as RawJson | undefined) ?? {};

  const canalRaw = tg.canal_admin_id;
  const canalAdminId =
    canalRaw == null || String(canalRaw).trim() === ''
      ? null
      : String(canalRaw).trim();

  const advPct = num(de.exceso_advertencia_pct, d.despacho.excesoAdvertenciaPct);
  const critPct = num(de.exceso_critico_pct, d.despacho.excesoCriticoPct, advPct);

  return {
    telegram: { canalAdminId },
    procuras: {
      estadosAlertar: strList(pr.estados_alertar, d.procuras.estadosAlertar),
      palabrasPrioridadAlta: strList(pr.palabras_prioridad_alta, d.procuras.palabrasPrioridadAlta),
      palabrasPrioridadMedia: strList(
        pr.palabras_prioridad_media,
        d.procuras.palabrasPrioridadMedia,
      ),
    },
    compras: {
      umbralAdvertenciaDias: num(co.umbral_advertencia_dias, d.compras.umbralAdvertenciaDias, 1),
      umbralCriticoDias: num(
        co.umbral_critico_dias,
        d.compras.umbralCriticoDias,
        num(co.umbral_advertencia_dias, d.compras.umbralAdvertenciaDias, 1),
      ),
      umbralFuturoCriticoDias: num(
        co.umbral_futuro_critico_dias,
        d.compras.umbralFuturoCriticoDias,
        1,
      ),
    },
    fastTrack: {
      limiteUsdDefault: num(ft.limite_usd_default, d.fastTrack.limiteUsdDefault),
      umbralConfianzaOcrPct: num(
        ft.umbral_confianza_ocr_pct,
        d.fastTrack.umbralConfianzaOcrPct,
        50,
      ),
    },
    despacho: {
      excesoAdvertenciaPct: advPct,
      excesoCriticoPct: critPct,
      saldoInformativoPct: num(de.saldo_informativo_pct, d.despacho.saldoInformativoPct),
    },
  };
}

export function configToJson(cfg: AlertasConfig): RawJson {
  return {
    telegram: { canal_admin_id: cfg.telegram.canalAdminId },
    procuras: {
      estados_alertar: cfg.procuras.estadosAlertar,
      palabras_prioridad_alta: cfg.procuras.palabrasPrioridadAlta,
      palabras_prioridad_media: cfg.procuras.palabrasPrioridadMedia,
    },
    compras: {
      umbral_advertencia_dias: cfg.compras.umbralAdvertenciaDias,
      umbral_critico_dias: cfg.compras.umbralCriticoDias,
      umbral_futuro_critico_dias: cfg.compras.umbralFuturoCriticoDias,
    },
    fast_track: {
      limite_usd_default: cfg.fastTrack.limiteUsdDefault,
      umbral_confianza_ocr_pct: cfg.fastTrack.umbralConfianzaOcrPct,
    },
    despacho: {
      exceso_advertencia_pct: cfg.despacho.excesoAdvertenciaPct,
      exceso_critico_pct: cfg.despacho.excesoCriticoPct,
      saldo_informativo_pct: cfg.despacho.saldoInformativoPct,
    },
  };
}

export type AlertasConfigMeta = {
  config: AlertasConfig;
  updatedAt: string | null;
  desdeBd: boolean;
  canalAdminEnv: string | null;
  canalAdminEfectivo: string | null;
};

export function canalAdminTelegramDesdeEnv(): string | null {
  const admin = process.env.TELEGRAM_ADMIN_CHANNEL_ID?.trim();
  if (admin) return admin;
  const almacen = process.env.TELEGRAM_ALMACEN_CHAT_IDS?.trim();
  if (almacen) {
    const first = almacen.split(/[,;\s]+/).map((s) => s.trim()).find(Boolean);
    if (first) return first;
  }
  return null;
}

export function resolverCanalAdminEfectivo(cfg: AlertasConfig): string | null {
  return cfg.telegram.canalAdminId?.trim() || canalAdminTelegramDesdeEnv();
}

export function prioridadProcuraDesdeObs(
  observaciones: string | null | undefined,
  cfg: AlertasConfig,
): string {
  const t = observaciones?.toLowerCase() ?? '';
  if (cfg.procuras.palabrasPrioridadAlta.some((p) => t.includes(p))) return 'Alta';
  if (cfg.procuras.palabrasPrioridadMedia.some((p) => t.includes(p))) return 'Media';
  return 'Normal';
}

export function debeAlertarProcura(estado: string, cfg: AlertasConfig): boolean {
  const e = estado.trim().toLowerCase();
  return cfg.procuras.estadosAlertar.some((s) => s.trim().toLowerCase() === e);
}

export async function cargarAlertasConfig(
  supabase: SupabaseClient,
): Promise<AlertasConfigMeta> {
  const { data, error } = await supabase
    .from('ci_alertas_config')
    .select('config, updated_at')
    .eq('id', 1)
    .maybeSingle();

  if (error?.message?.includes('ci_alertas_config') || error?.code === '42P01') {
    const cfg = ALERTAS_CONFIG_DEFAULT;
    return {
      config: cfg,
      updatedAt: null,
      desdeBd: false,
      canalAdminEnv: canalAdminTelegramDesdeEnv(),
      canalAdminEfectivo: resolverCanalAdminEfectivo(cfg),
    };
  }
  if (error) throw new Error(error.message);

  const cfg = parseConfigJson((data?.config as RawJson | null) ?? null);
  return {
    config: cfg,
    updatedAt: data?.updated_at ? String(data.updated_at) : null,
    desdeBd: Boolean(data),
    canalAdminEnv: canalAdminTelegramDesdeEnv(),
    canalAdminEfectivo: resolverCanalAdminEfectivo(cfg),
  };
}

export async function guardarAlertasConfig(
  supabase: SupabaseClient,
  partial: Partial<AlertasConfig>,
): Promise<AlertasConfigMeta> {
  const actual = await cargarAlertasConfig(supabase);
  const merged: AlertasConfig = {
    telegram: { ...actual.config.telegram, ...partial.telegram },
    procuras: { ...actual.config.procuras, ...partial.procuras },
    compras: { ...actual.config.compras, ...partial.compras },
    fastTrack: { ...actual.config.fastTrack, ...partial.fastTrack },
    despacho: { ...actual.config.despacho, ...partial.despacho },
  };

  const { error: upErr } = await supabase
    .from('ci_alertas_config')
    .upsert({ id: 1, config: configToJson(merged) } as never, { onConflict: 'id' });

  if (upErr) throw new Error(upErr.message);
  return cargarAlertasConfig(supabase);
}

export function umbralesFechaDesdeConfig(
  cfg: AlertasConfig = ALERTAS_CONFIG_DEFAULT,
): UmbralesFechaCompra {
  return {
    advertenciaDias: cfg.compras.umbralAdvertenciaDias,
    criticoDias: cfg.compras.umbralCriticoDias,
    futuroCriticoDias: cfg.compras.umbralFuturoCriticoDias,
  };
}

export function despachoDefaultsDesdeConfig(
  cfg: AlertasConfig = ALERTAS_CONFIG_DEFAULT,
) {
  return { ...cfg.despacho };
}

export function umbralesFechaComprasPublicos(cfg: AlertasConfig) {
  return umbralesFechaDesdeConfig(cfg);
}

export function validarAlertasConfig(cfg: AlertasConfig): string | null {
  if (cfg.compras.umbralCriticoDias < cfg.compras.umbralAdvertenciaDias) {
    return 'Compras: el umbral crítico debe ser ≥ advertencia.';
  }
  if (cfg.despacho.excesoCriticoPct < cfg.despacho.excesoAdvertenciaPct) {
    return 'Despacho: el % crítico debe ser ≥ advertencia.';
  }
  if (cfg.fastTrack.umbralConfianzaOcrPct < 50 || cfg.fastTrack.umbralConfianzaOcrPct > 100) {
    return 'Fast-track: confianza OCR debe estar entre 50 y 100.';
  }
  if (cfg.procuras.estadosAlertar.length === 0) {
    return 'Procuras: indique al menos un estado que dispare alerta.';
  }
  return null;
}
