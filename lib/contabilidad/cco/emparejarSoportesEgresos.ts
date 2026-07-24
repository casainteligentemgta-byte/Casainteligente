/**
 * Agente de conciliación: factura (PDF/imagen) → egreso CCO sin soporte.
 * OCR (Gemini) + scoring proveedor/fecha/monto.
 */

import {
  extractPurchaseInvoiceFromFile,
  mimeFromFile,
} from '@/lib/almacen/extractPurchaseInvoiceGemini';
import {
  decidirMatchFacturaEgresos,
  MAX_BYTES_SOPORTE,
  MAX_SOPORTES_POR_REQUEST,
  type CandidatoScore,
  type DecisionMatch,
  type EgresoCandidatoSoporte,
} from '@/lib/contabilidad/cco/emparejarSoportesEgresosScoring';

export {
  UMBRAL_AUTO,
  UMBRAL_DUDA,
  MARGEN_AUTO_VS_SEGUNDO,
  MAX_SOPORTES_POR_REQUEST,
  MAX_BYTES_SOPORTE,
  decidirMatchFacturaEgresos,
  puntuarEgresoContraFactura,
  type EgresoCandidatoSoporte,
  type CandidatoScore,
  type DecisionMatch,
  type DesgloseMatch,
  type FacturaCabeceraMatch,
} from '@/lib/contabilidad/cco/emparejarSoportesEgresosScoring';

export type SoporteArchivoInput = {
  id: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type MatchSoporteEgreso = {
  archivoId: string;
  fileName: string;
  decision: DecisionMatch;
  egresoId: string | null;
  confianza: number;
  candidatos: CandidatoScore[];
  leido: {
    invoice_number: string;
    supplier_name: string;
    supplier_rif: string;
    fecha: string;
    total_amount: number | null;
  };
  motivo: string;
  error?: string;
};

const ALLOWED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

export function mimeFromSoporteFactura(file: File): string | null {
  const t = (file.type || '').toLowerCase();
  if (ALLOWED.has(t) || t.startsWith('image/')) return t || 'application/octet-stream';
  return mimeFromFile({ type: file.type, name: file.name });
}

/**
 * OCR + matching para un lote de soportes vs egresos sin factura.
 */
export async function emparejarSoportesConEgresos(params: {
  egresos: EgresoCandidatoSoporte[];
  archivos: SoporteArchivoInput[];
  concurrency?: number;
}): Promise<{ matches: MatchSoporteEgreso[]; modelHint: string }> {
  const { egresos, archivos } = params;
  if (egresos.length === 0) {
    throw new Error('No hay egresos sin soporte para emparejar.');
  }
  if (archivos.length === 0) {
    throw new Error('Envíe al menos un PDF o imagen de factura.');
  }
  if (archivos.length > MAX_SOPORTES_POR_REQUEST) {
    throw new Error(
      `Máximo ${MAX_SOPORTES_POR_REQUEST} archivos por lote. Procese por lotes.`,
    );
  }

  const concurrency = Math.max(1, Math.min(params.concurrency ?? 2, 3));
  const matches: MatchSoporteEgreso[] = [];
  let i = 0;
  let modelHint = 'gemini';

  async function worker() {
    while (i < archivos.length) {
      const idx = i++;
      const archivo = archivos[idx]!;
      matches[idx] = await emparejarUnSoporte(archivo, egresos, (m) => {
        modelHint = m;
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, archivos.length) }, () => worker()),
  );

  const porEgreso = new Map<string, MatchSoporteEgreso>();
  for (const m of matches) {
    if (m.decision !== 'auto' || !m.egresoId) continue;
    const prev = porEgreso.get(m.egresoId);
    if (!prev || m.confianza > prev.confianza) {
      porEgreso.set(m.egresoId, m);
    }
  }
  const ganadores = new Set(
    Array.from(porEgreso.values()).map((m) => `${m.archivoId}::${m.egresoId}`),
  );

  const resueltos = matches.map((m) => {
    if (m.decision !== 'auto' || !m.egresoId) return m;
    if (ganadores.has(`${m.archivoId}::${m.egresoId}`)) return m;
    return {
      ...m,
      decision: 'duda' as const,
      motivo: `${m.motivo} · Otro archivo también apunta a este egreso; confirme manualmente.`,
    };
  });

  return { matches: resueltos, modelHint };
}

async function emparejarUnSoporte(
  archivo: SoporteArchivoInput,
  egresos: EgresoCandidatoSoporte[],
  onModel: (m: string) => void,
): Promise<MatchSoporteEgreso> {
  const vacio = (extra: Partial<MatchSoporteEgreso>): MatchSoporteEgreso => ({
    archivoId: archivo.id,
    fileName: archivo.fileName,
    decision: 'sin_match',
    egresoId: null,
    confianza: 0,
    candidatos: [],
    leido: {
      invoice_number: '',
      supplier_name: '',
      supplier_rif: '',
      fecha: '',
      total_amount: null,
    },
    motivo: 'No se pudo analizar',
    ...extra,
  });

  if (!ALLOWED.has(archivo.mimeType) && !archivo.mimeType.startsWith('image/')) {
    return vacio({
      motivo: 'Formato no soportado',
      error: 'Use JPG, PNG, WEBP o PDF',
    });
  }
  if (archivo.buffer.byteLength > MAX_BYTES_SOPORTE) {
    return vacio({
      motivo: 'Archivo demasiado grande',
      error: 'Máximo 12 MB por archivo',
    });
  }

  try {
    const { data, modelUsed } = await extractPurchaseInvoiceFromFile({
      buffer: archivo.buffer,
      mimeType: archivo.mimeType,
      fileName: archivo.fileName,
    });
    onModel(modelUsed);

    const decided = decidirMatchFacturaEgresos(data, egresos);
    return {
      archivoId: archivo.id,
      fileName: archivo.fileName,
      decision: decided.decision,
      egresoId: decided.egresoId,
      confianza: decided.confianza,
      candidatos: decided.candidatos,
      leido: {
        invoice_number: data.invoice_number || '',
        supplier_name: data.supplier_name || '',
        supplier_rif: data.supplier_rif || '',
        fecha: data.date || '',
        total_amount: data.total_amount,
      },
      motivo: decided.motivo,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return vacio({
      motivo: 'Error OCR',
      error: msg.slice(0, 220),
    });
  }
}
