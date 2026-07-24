import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarAlertasConfig } from '@/lib/alertas/alertasConfig';
import { buscarPrecioHistoricoUnitarioUsd } from '@/lib/compras/precioHistoricoMaterialProcura';
import { limpiarDescripcionProcura } from '@/lib/compras/procuraMaterialTexto';

export { limpiarDescripcionProcura } from '@/lib/compras/procuraMaterialTexto';

export type EvaluacionViaRapida = {
  califica: boolean;
  motivo: string;
  limiteUsd: number;
  /** Costo total estimado usado en la decisión (histórico o declarado). */
  montoEstimadoEfectivoUsd?: number | null;
  precioUnitarioHistoricoUsd?: number | null;
  /** Fallo de red/BD al consultar precio histórico (monto omitido). */
  errorConsultaHistorico?: boolean;
};

/** Whitelist estricta de palabras consumibles (coincidencia por palabra completa). */
export const PALABRAS_CONSUMIBLE_ESTRICTO = [
  'consumible',
  'consumibles',
  'papel',
  'tinta',
  'toner',
  'tóner',
  'lapicero',
  'boligrafo',
  'bolígrafo',
  'bateria',
  'batería',
  'cinta',
  'pegamento',
  'detergente',
  'guante',
  'mascarilla',
  'brocha',
  'lija',
] as const;

/** Consumibles inequívocos de bajísimo costo (excepción sin historial ni monto). */
const CONSUMIBLES_BAJISIMO_COSTO = ['boligrafo', 'bolígrafo', 'lapicero', 'lija', 'goma', 'borrador'] as const;

function normalizarTextoMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Coincidencia estricta por palabra (no subcadena dentro de otra palabra). */
export function coincideConsumibleEstricto(descripcion: string): boolean {
  const norm = normalizarTextoMatch(limpiarDescripcionProcura(descripcion));
  if (!norm) return false;
  return PALABRAS_CONSUMIBLE_ESTRICTO.some((p) => {
    const palabra = normalizarTextoMatch(p);
    const re = new RegExp(`\\b${escapeRegExp(palabra)}\\b`, 'i');
    return re.test(norm);
  });
}

export function esConsumibleBajisimoCosto(descripcion: string): boolean {
  const norm = normalizarTextoMatch(limpiarDescripcionProcura(descripcion));
  if (!norm) return false;
  return CONSUMIBLES_BAJISIMO_COSTO.some((p) => {
    const palabra = normalizarTextoMatch(p);
    const re = new RegExp(`\\b${escapeRegExp(palabra)}\\b`, 'i');
    return re.test(norm);
  });
}

/** Tope USD para vía rápida (configurable en ci_alertas_config.fast_track). */
export async function limiteViaRapidaUsd(
  supabase: SupabaseClient,
  override?: number,
): Promise<number> {
  if (override != null && Number.isFinite(override)) return override;
  const { config: alertas } = await cargarAlertasConfig(supabase);
  return alertas.fastTrack.limiteUsdDefault ?? 50;
}

function rechazar(limite: number, motivo: string, extra?: Partial<EvaluacionViaRapida>): EvaluacionViaRapida {
  return { califica: false, motivo, limiteUsd: limite, ...extra };
}

function aprobar(limite: number, motivo: string, extra?: Partial<EvaluacionViaRapida>): EvaluacionViaRapida {
  return { califica: true, motivo, limiteUsd: limite, ...extra };
}

async function evaluarSkipMontoUsd(
  supabase: SupabaseClient,
  params: {
    descripcionMaterial: string;
    cantidad: number;
    materialId?: string | null;
    limiteUsd: number;
  },
): Promise<EvaluacionViaRapida> {
  const { limiteUsd, cantidad } = params;
  const descripcion = limpiarDescripcionProcura(params.descripcionMaterial);

  if (!coincideConsumibleEstricto(descripcion)) {
    return rechazar(
      limiteUsd,
      'Sin monto USD y sin coincidencia estricta de consumible — requiere aprobación (vía larga)',
    );
  }

  const resultadoHistorico = await buscarPrecioHistoricoUnitarioUsd(supabase, {
    materialId: params.materialId,
    descripcionMaterial: descripcion,
  });

  if (resultadoHistorico.errorConsulta) {
    return rechazar(
      limiteUsd,
      'No se pudo verificar costo histórico por problemas de conexión — vía larga',
      { errorConsultaHistorico: true },
    );
  }

  const historico = resultadoHistorico.precio;
  if (historico) {
    const totalHistorico = historico.precioUnitarioUsd * cantidad;
    const extra = {
      montoEstimadoEfectivoUsd: totalHistorico,
      precioUnitarioHistoricoUsd: historico.precioUnitarioUsd,
    };
    if (totalHistorico >= limiteUsd) {
      return rechazar(
        limiteUsd,
        `Consumible con costo histórico USD ${totalHistorico.toFixed(2)} ≥ ${limiteUsd} (monto omitido) — vía larga`,
        extra,
      );
    }
    return aprobar(
      limiteUsd,
      `Consumible: costo histórico USD ${totalHistorico.toFixed(2)} < ${limiteUsd} (${historico.fuente})`,
      extra,
    );
  }

  if (esConsumibleBajisimoCosto(descripcion)) {
    return aprobar(
      limiteUsd,
      'Consumible inequívoco de bajísimo costo sin historial de precio',
    );
  }

  return rechazar(
    limiteUsd,
    'Consumible sin precio histórico ni monto USD — vía larga por seguridad financiera',
  );
}

/**
 * Vía rápida (aprobada_directa): monto declarado bajo el techo, o consumible con historial bajo techo.
 * Si se omite el monto (skip), aplica whitelist estricta + precio histórico o excepción de bajísimo costo.
 */
export async function evaluarViaRapidaProcura(
  supabase: SupabaseClient,
  params: {
    descripcionMaterial: string;
    montoEstimadoUsd: number | null;
    esConsumible?: boolean;
    limiteUsdOverride?: number;
    cantidad?: number;
    materialId?: string | null;
  },
): Promise<EvaluacionViaRapida> {
  const limiteEfectivo = await limiteViaRapidaUsd(supabase, params.limiteUsdOverride);
  const cantidad =
    params.cantidad != null && Number.isFinite(params.cantidad) && params.cantidad > 0
      ? params.cantidad
      : 1;
  const descripcion = limpiarDescripcionProcura(params.descripcionMaterial);
  const montoOmitido = params.montoEstimadoUsd == null;

  if (montoOmitido) {
    return evaluarSkipMontoUsd(supabase, {
      descripcionMaterial: descripcion,
      cantidad,
      materialId: params.materialId,
      limiteUsd: limiteEfectivo,
    });
  }

  const monto = params.montoEstimadoUsd!;
  if (!Number.isFinite(monto) || monto < 0) {
    return rechazar(limiteEfectivo, 'Monto USD inválido — requiere aprobación');
  }

  if (monto >= limiteEfectivo) {
    return rechazar(
      limiteEfectivo,
      `Monto USD ${monto.toFixed(2)} ≥ ${limiteEfectivo} — requiere aprobación`,
      { montoEstimadoEfectivoUsd: monto },
    );
  }

  if (params.esConsumible && !coincideConsumibleEstricto(descripcion)) {
    return aprobar(
      limiteEfectivo,
      `Monto estimado USD ${monto.toFixed(2)} < ${limiteEfectivo} (consumible marcado, texto no validado estrictamente)`,
      { montoEstimadoEfectivoUsd: monto },
    );
  }

  return aprobar(
    limiteEfectivo,
    `Monto estimado USD ${monto.toFixed(2)} < ${limiteEfectivo}`,
    { montoEstimadoEfectivoUsd: monto },
  );
}

export type PrioridadProcura = 'Baja' | 'Media' | 'Alta';

/** D-10 / flujo Telegram: infiere consumible y monto USD sin preguntar al usuario. */
export async function inferirConsumibleYMontoProcura(
  supabase: SupabaseClient,
  params: {
    descripcionMaterial: string;
    cantidad: number;
    materialId?: string | null;
  },
): Promise<{
  esConsumible: boolean;
  montoEstimadoUsd: number | null;
  precioUnitarioUsd: number | null;
  notaAuto: string;
}> {
  const descripcion = limpiarDescripcionProcura(params.descripcionMaterial);
  const esConsumible = coincideConsumibleEstricto(descripcion);

  const resultadoHistorico = await buscarPrecioHistoricoUnitarioUsd(supabase, {
    materialId: params.materialId,
    descripcionMaterial: descripcion,
  });

  const unitario = resultadoHistorico.precio?.precioUnitarioUsd ?? null;
  const montoEstimadoUsd =
    unitario != null && params.cantidad > 0 ? unitario * params.cantidad : null;

  const partes: string[] = [];
  if (esConsumible) {
    partes.push('consumible detectado por descripción');
  }
  if (montoEstimadoUsd != null) {
    partes.push(
      `USD ~${montoEstimadoUsd.toFixed(2)} (${unitario!.toFixed(2)}/u × ${params.cantidad})`,
    );
  } else if (resultadoHistorico.errorConsulta) {
    partes.push('sin precio histórico (error de consulta)');
  } else {
    partes.push('sin precio histórico — vía larga o validación al confirmar');
  }

  return {
    esConsumible,
    montoEstimadoUsd,
    precioUnitarioUsd: unitario,
    notaAuto: partes.join(' · '),
  };
}

export function parsePrioridadProcura(v: string): PrioridadProcura | null {
  const t = v.trim();
  if (t === 'Baja' || t === 'Media' || t === 'Alta') return t;
  const lower = t.toLowerCase();
  if (lower === 'baja') return 'Baja';
  if (lower === 'media') return 'Media';
  if (lower === 'alta') return 'Alta';
  return null;
}
