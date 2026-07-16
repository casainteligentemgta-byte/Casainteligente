import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';

const UMBRAL_FAST_TRACK = 95;

function puntajeCampo(ok: boolean, peso: number): number {
  return ok ? peso : 0;
}

/** Estima confianza OCR (0–100) a partir de completitud estructural del JSON Gemini. */
export function calcularConfidenceScoreOcr(
  data: ExtractedPurchaseInvoice,
  ocrConfidence?: number | null,
): number {
  const items = data.items ?? [];
  const itemsConCodigo = items.filter((i) => String(i.item_code ?? '').trim().length > 0);
  const itemsCompletos = items.filter(
    (i) =>
      String(i.description ?? '').trim().length > 2 &&
      Number(i.quantity) > 0 &&
      Number(i.unit_price) >= 0,
  );

  let score =
    puntajeCampo(Boolean(data.invoice_number?.trim()), 12) +
    puntajeCampo(Boolean(data.supplier_name?.trim()), 12) +
    puntajeCampo(Boolean(data.supplier_rif?.trim()), 8) +
    puntajeCampo(Boolean(data.date?.trim()), 10) +
    puntajeCampo(data.total_amount != null && Number(data.total_amount) > 0, 10) +
    puntajeCampo(items.length > 0, 15) +
    puntajeCampo(itemsCompletos.length === items.length && items.length > 0, 18) +
    puntajeCampo(itemsConCodigo.length === items.length && items.length > 0, 15);

  if (typeof ocrConfidence === 'number' && Number.isFinite(ocrConfidence)) {
    score = Math.max(score, Math.min(100, ocrConfidence));
  }

  return Math.min(100, Math.round(score * 100) / 100);
}

export function cumpleUmbralFastTrack(
  confidenceScore: number,
  umbral: number = UMBRAL_FAST_TRACK,
): boolean {
  return confidenceScore > umbral;
}

export const UMBRAL_MONTO_FAST_TRACK_USD = 100;
