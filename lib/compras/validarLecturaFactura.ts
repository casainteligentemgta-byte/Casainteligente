/**
 * Validación de lecturas OCR de facturas y decisión de re-lectura lite → flash.
 * Puro: sin I/O. No confirma compras.
 */

import { totalesAlbumCuadran } from '@/lib/canal/fusionarLineasAlbumFactura';
import { esRifVenezolano } from '@/lib/contabilidad/rifVenezolano';
import {
  monedaExtractedConfirmada,
  normalizarMonedaExtracted,
  type AnomaliaFacturaCanal,
  type ExtractedCanalHeader,
  type RevisionManualFactura,
} from '@/lib/contabilidad/extractedCanal';
import { esNotaEntregaCanal } from '@/lib/compras/notaEntregaCanal';
import { tasaBcvVesPorUsdFromEnv } from '@/lib/nomina/tasaBcvVesPorUsd';
import {
  GEMINI_PROCUREMENT_DEFAULT_MODEL,
  esModeloLiteOcr,
} from '@/lib/almacen/geminiProcurementModels';

/** Confianza mínima (0–1) para no marcar revisión ni re-leer el modelo lite. */
export const UMBRAL_CONFIANZA_REVISION = 0.8;

/**
 * Reserva mínima para un segundo pase Gemini dentro del maxDuration de Vercel (~180 s).
 * Si queda menos, se omite la re-lectura y se marca para revisión.
 */
export const PRESUPUESTO_MS_RELECTURA_MINIMO = 40_000;

/** Tope operativo de la función serverless (deja ~5 s de colchón). */
export const LIMITE_MS_FUNCION_VERCEL = 175_000;

/** Modelo de calidad para el segundo pase. */
export const MODELO_RELECTURA_OCR = GEMINI_PROCUREMENT_DEFAULT_MODEL;

/**
 * Si el total etiquetado USD es ≥ este múltiplo de la tasa BCV (Bs/USD),
 * el número parece bolívares mal etiquetados (p. ej. 135 389 «USD» con tasa ~772).
 */
export const MULTIPLO_BCV_TOTAL_USD_SOSPECHOSO = 20;

/** Tasa de respaldo (homologación 2026) si no hay BCV en env ni parámetro. */
export const FALLBACK_TASA_BCV_VES_POR_USD = 772.5441;

export const MENSAJE_CONFIRMACION_BLOQUEADA =
  'Esta factura tiene alertas de lectura y no se puede confirmar hasta revisarlas. Corrija los datos o márquela como revisada.';

export type LecturaFacturaParaValidar = {
  invoice_number?: string | null;
  supplier_rif?: string | null;
  supplier_name?: string | null;
  total_amount?: number | null;
  moneda?: string | null;
  confidence_score?: number | null;
  document_kind?: string | null;
  items?: Array<{
    description?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
  }> | null;
};

export type RelecturaOcrMeta = {
  intentada: boolean;
  omitida_por_tiempo?: boolean;
  modelo?: string;
  modelo_inicial?: string;
  ganador?: string;
  motivo?: string;
};

export type DecisionRelecturaFlash = {
  releer: boolean;
  omitidaPorTiempo: boolean;
  motivo: string;
};

export type OpcionesValidacionLectura = {
  tasaBcv?: number | null;
  /** Texto OCR crudo, si existe, para indicadores Bs / IVA. */
  textoDocumento?: string | null;
};

function redondear2(n: number): string {
  return n.toLocaleString('es-VE', { maximumFractionDigits: 2 });
}

/** Normaliza confianza Gemini (0–1 o 0–100) a 0–1. */
export function confianza01(score?: number | null): number | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const n = Number(score);
  if (n < 0) return 0;
  if (n <= 1) return n;
  return Math.min(1, n / 100);
}

export function confianzaBaja(
  score?: number | null,
  umbral: number = UMBRAL_CONFIANZA_REVISION,
): boolean {
  const n = confianza01(score);
  if (n == null) return false;
  return n < umbral;
}

export function tasaBcvParaValidacion(tasaBcv?: number | null): number {
  if (tasaBcv != null && Number.isFinite(tasaBcv) && tasaBcv > 1) return tasaBcv;
  const env = tasaBcvVesPorUsdFromEnv();
  if (env != null && env > 1) return env;
  return FALLBACK_TASA_BCV_VES_POR_USD;
}

function textoIndicadores(
  extracted: LecturaFacturaParaValidar,
  extra?: string | null,
): string {
  const items = (extracted.items ?? [])
    .map((it) => String(it.description ?? ''))
    .join(' ');
  return [
    extra ?? '',
    extracted.supplier_name ?? '',
    extracted.invoice_number ?? '',
    items,
  ].join(' ');
}

/**
 * Total en USD demasiado grande para ser dólares: parece bolívares
 * (magnitud vs BCV, RIF venezolano, indicadores Bs / IVA 16 %).
 */
export function monedaInconsistenteBsComoUsd(
  extracted: LecturaFacturaParaValidar,
  opts?: OpcionesValidacionLectura,
): boolean {
  if (!monedaExtractedConfirmada(extracted.moneda)) return false;
  if (normalizarMonedaExtracted(extracted.moneda) !== 'USD') return false;
  const total = extracted.total_amount != null ? Number(extracted.total_amount) : NaN;
  if (!Number.isFinite(total) || total <= 0) return false;

  const tasa = tasaBcvParaValidacion(opts?.tasaBcv);
  const umbralMagnitud = MULTIPLO_BCV_TOTAL_USD_SOSPECHOSO * tasa;
  const magnitudSospechosa = total >= umbralMagnitud;
  const rifVe = esRifVenezolano(extracted.supplier_rif);
  const blob = textoIndicadores(extracted, opts?.textoDocumento);
  const indicaBs = /\bBs\.?\b|\bbolivares\b|\bbolívares\b/i.test(blob);
  const indicaIvaVe = /IVA\s*16\s*%/i.test(blob);

  if (magnitudSospechosa) return true;
  if (rifVe && total >= 8 * tasa) return true;
  if (indicaBs) return true;
  if (indicaIvaVe && rifVe && total >= 4 * tasa) return true;
  return false;
}

function lineasConDescripcion(extracted: LecturaFacturaParaValidar) {
  return (extracted.items ?? []).filter((it) => String(it.description ?? '').trim());
}

/** Alertas estructurales de una lectura OCR (precio/cantidad 0, suma, moneda, confianza). */
export function validarLecturaFactura(
  extracted: LecturaFacturaParaValidar,
  opts?: OpcionesValidacionLectura,
): AnomaliaFacturaCanal[] {
  const out: AnomaliaFacturaCanal[] = [];
  const esNota = esNotaEntregaCanal(extracted as Record<string, unknown>);

  if (confianzaBaja(extracted.confidence_score)) {
    const pct = Math.round((confianza01(extracted.confidence_score) ?? 0) * 100);
    out.push({
      tipo: 'confianza_baja',
      severidad: 'alerta',
      mensaje: `La confianza de la lectura es ${pct}% (mínimo ${Math.round(UMBRAL_CONFIANZA_REVISION * 100)}%). Revise la factura antes de confirmar.`,
    });
  }

  if (esNota) return out;

  const items = lineasConDescripcion(extracted);
  for (const it of items) {
    const desc = String(it.description ?? '').trim();
    const precio = Number(it.unit_price);
    const cantidad = Number(it.quantity);
    if (!Number.isFinite(precio) || precio === 0) {
      out.push({
        tipo: 'precio_cero',
        severidad: 'alerta',
        mensaje: `La línea «${desc}» tiene precio 0.`,
        detalle: desc,
      });
    }
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      out.push({
        tipo: 'cantidad_cero',
        severidad: 'alerta',
        mensaje: `La línea «${desc}» tiene cantidad 0.`,
        detalle: desc,
      });
    }
  }

  const total = extracted.total_amount != null ? Number(extracted.total_amount) : null;
  if (items.length > 0 && total != null && Number.isFinite(total) && total > 0) {
    const cuadre = totalesAlbumCuadran({
      items: items.map((it) => ({
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      })),
      total,
    });
    if (!cuadre.ok) {
      out.push({
        tipo: 'suma_lineas_distinta',
        severidad: 'alerta',
        mensaje: `La suma de líneas (${redondear2(cuadre.sumaLineas)}) no coincide con el total (${redondear2(total)}), ni con IVA 16 %.`,
      });
    }
  }

  if (monedaInconsistenteBsComoUsd(extracted, opts)) {
    const total = Number(extracted.total_amount);
    out.push({
      tipo: 'moneda_inconsistente',
      severidad: 'alerta',
      mensaje: `El total (${redondear2(total)}) parece estar en bolívares, pero la moneda quedó en USD. Confirme Bs o USD.`,
    });
  }

  return out;
}

export function decidirRelecturaFlash(params: {
  modelUsed: string;
  confidence?: number | null;
  alertas: Array<{ tipo?: string }>;
  remainingMs: number;
  umbralConfianza?: number;
  presupuestoMinimoMs?: number;
}): DecisionRelecturaFlash {
  const presupuesto = params.presupuestoMinimoMs ?? PRESUPUESTO_MS_RELECTURA_MINIMO;
  if (!esModeloLiteOcr(params.modelUsed)) {
    return { releer: false, omitidaPorTiempo: false, motivo: 'modelo_no_lite' };
  }
  const baja = confianzaBaja(params.confidence, params.umbralConfianza);
  const hayAlertas = params.alertas.length > 0;
  if (!baja && !hayAlertas) {
    return { releer: false, omitidaPorTiempo: false, motivo: 'lectura_ok' };
  }
  if (params.remainingMs < presupuesto) {
    return { releer: false, omitidaPorTiempo: true, motivo: 'presupuesto_tiempo' };
  }
  return {
    releer: true,
    omitidaPorTiempo: false,
    motivo: baja && hayAlertas ? 'confianza_y_alertas' : baja ? 'confianza_baja' : 'alertas',
  };
}

export function elegirMejorLectura<T extends LecturaFacturaParaValidar>(
  a: { data: T; modelUsed: string; alertas: AnomaliaFacturaCanal[] },
  b: { data: T; modelUsed: string; alertas: AnomaliaFacturaCanal[] },
): { data: T; modelUsed: string; motivo: string } {
  const nA = lineasConDescripcion(a.data).length;
  const nB = lineasConDescripcion(b.data).length;
  if (nA > 0 && nB === 0) {
    return { data: a.data, modelUsed: a.modelUsed, motivo: 'conservar_lineas' };
  }
  if (nB > 0 && nA === 0) {
    return { data: b.data, modelUsed: b.modelUsed, motivo: 'conservar_lineas' };
  }
  if (b.alertas.length < a.alertas.length) {
    return { data: b.data, modelUsed: b.modelUsed, motivo: 'menos_alertas' };
  }
  if (a.alertas.length < b.alertas.length) {
    return { data: a.data, modelUsed: a.modelUsed, motivo: 'menos_alertas' };
  }
  const ca = confianza01(a.data.confidence_score) ?? 0;
  const cb = confianza01(b.data.confidence_score) ?? 0;
  if (cb > ca) return { data: b.data, modelUsed: b.modelUsed, motivo: 'mayor_confianza' };
  if (ca > cb) return { data: a.data, modelUsed: a.modelUsed, motivo: 'mayor_confianza' };
  return { data: b.data, modelUsed: b.modelUsed, motivo: 'empate_preferir_flash' };
}

export async function aplicarPoliticaRelecturaOcr<T extends LecturaFacturaParaValidar>(params: {
  primera: { data: T; modelUsed: string };
  remainingMs: number;
  releer: () => Promise<{ data: T; modelUsed: string }>;
  validar?: (data: T) => AnomaliaFacturaCanal[];
  ahora?: () => number;
}): Promise<{ data: T; modelUsed: string; relectura: RelecturaOcrMeta }> {
  const validar = params.validar ?? ((d: T) => validarLecturaFactura(d));
  const alertas1 = validar(params.primera.data);
  const decision = decidirRelecturaFlash({
    modelUsed: params.primera.modelUsed,
    confidence: params.primera.data.confidence_score,
    alertas: alertas1,
    remainingMs: params.remainingMs,
  });

  const baseMeta: RelecturaOcrMeta = {
    intentada: false,
    modelo_inicial: params.primera.modelUsed,
    ganador: params.primera.modelUsed,
    motivo: decision.motivo,
  };

  if (decision.omitidaPorTiempo) {
    return {
      data: params.primera.data,
      modelUsed: params.primera.modelUsed,
      relectura: { ...baseMeta, omitida_por_tiempo: true },
    };
  }
  if (!decision.releer) {
    return {
      data: params.primera.data,
      modelUsed: params.primera.modelUsed,
      relectura: baseMeta,
    };
  }

  try {
    const segunda = await params.releer();
    const alertas2 = validar(segunda.data);
    const mejor = elegirMejorLectura(
      { data: params.primera.data, modelUsed: params.primera.modelUsed, alertas: alertas1 },
      { data: segunda.data, modelUsed: segunda.modelUsed, alertas: alertas2 },
    );
    return {
      data: mejor.data,
      modelUsed: mejor.modelUsed,
      relectura: {
        intentada: true,
        modelo: segunda.modelUsed,
        modelo_inicial: params.primera.modelUsed,
        ganador: mejor.modelUsed,
        motivo: mejor.motivo,
      },
    };
  } catch {
    return {
      data: params.primera.data,
      modelUsed: params.primera.modelUsed,
      relectura: {
        intentada: true,
        modelo: MODELO_RELECTURA_OCR,
        modelo_inicial: params.primera.modelUsed,
        ganador: params.primera.modelUsed,
        motivo: 'relectura_fallida',
      },
    };
  }
}

export function tieneRevisionManual(
  extracted: Pick<ExtractedCanalHeader, 'revision_manual'> | null | undefined,
): boolean {
  const at = extracted?.revision_manual?.at;
  return Boolean(at && String(at).trim());
}

export function aplicarRevisionManual(
  extracted: ExtractedCanalHeader,
  actor: { userId: string; email?: string | null; nombre?: string | null },
  at: string = new Date().toISOString(),
): ExtractedCanalHeader {
  const revision_manual: RevisionManualFactura = {
    por_user_id: actor.userId,
    por_email: actor.email ?? null,
    por_nombre: actor.nombre ?? null,
    at,
  };
  return { ...extracted, revision_manual };
}

export function requiereRevisionPorAlertas(
  extracted: ExtractedCanalHeader | LecturaFacturaParaValidar | null | undefined,
  opts?: OpcionesValidacionLectura,
): boolean {
  if (!extracted) return false;
  if (tieneRevisionManual(extracted as ExtractedCanalHeader)) return false;
  return validarLecturaFactura(extracted, opts).length > 0;
}

export function mensajeBloqueoConfirmacion(
  extracted: ExtractedCanalHeader | LecturaFacturaParaValidar | null | undefined,
  opts?: OpcionesValidacionLectura,
): string | null {
  if (!extracted) return null;
  if (tieneRevisionManual(extracted as ExtractedCanalHeader)) return null;
  const alertas = validarLecturaFactura(extracted, opts);
  if (!alertas.length) return null;
  const detalle = alertas
    .slice(0, 3)
    .map((a) => a.mensaje)
    .join(' ');
  return `${MENSAJE_CONFIRMACION_BLOQUEADA} ${detalle}`.trim();
}

export function aplicarAlertasAExtracted(
  extracted: ExtractedCanalHeader,
  anomalias: AnomaliaFacturaCanal[],
): { extracted: ExtractedCanalHeader; requiere_revision: boolean } {
  const manual = tieneRevisionManual(extracted);
  return {
    extracted: { ...extracted, anomalias },
    requiere_revision: anomalias.length > 0 && !manual,
  };
}
