import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import type { ResultadoComparacionFactura } from '@/lib/contabilidad/certificarFacturaAdjunta';
import type { OcrAdjuntarResult } from '@/components/contabilidad/CertificarFacturaAdjuntaModal';

export type AdjuntarFacturaConOcrResponse = {
  ok: boolean;
  error?: string;
  fileName?: string;
  url?: string;
  ocr?:
    | OcrAdjuntarResult
    | { ok: false; error: string }
    | { skipped: true };
};

/**
 * Sube el documento y dispara OCR/certificación (salvo ocr=false).
 */
export async function adjuntarFacturaConOcr(
  compraId: string,
  file: File,
  opts?: { ocr?: boolean },
): Promise<AdjuntarFacturaConOcrResponse> {
  const form = new FormData();
  form.append('documento', file, file.name);
  const q = opts?.ocr === false ? '?ocr=0' : '';
  const res = await fetch(
    `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document${q}`,
    { method: 'POST', body: form },
  );
  const data = (await res.json()) as AdjuntarFacturaConOcrResponse;
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || 'No se pudo adjuntar la factura' };
  }
  return data;
}

export function esOcrAdjuntarOk(
  ocr: AdjuntarFacturaConOcrResponse['ocr'],
): ocr is OcrAdjuntarResult {
  return Boolean(ocr && 'ok' in ocr && ocr.ok === true && 'certificacion' in ocr);
}

export type { ExtractedPurchaseInvoice, ResultadoComparacionFactura };
