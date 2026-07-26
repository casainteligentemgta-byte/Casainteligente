/**
 * Flujo cliente del agente de soportes:
 * 1) OCR archivo a archivo (evita HTTP 413)
 * 2) Match local contra el cuadro de egresos
 */

import {
  emparejarOcrContraEgresosLocal,
  type DecisionMatch,
  type EgresoCandidatoSoporte,
  type MatchSoporteEgresoCliente,
  type OcrSoporteParaMatch,
} from '@/lib/contabilidad/cco/emparejarSoportesEgresosScoring';
import {
  mensajeErrorEmparejarSoportes,
  parseRespuestaEmparejarSoportes,
} from '@/lib/contabilidad/cco/parseRespuestaEmparejarSoportes';

export type ArchivoSoporteLocal = { id: string; file: File };

export type MatchSoporteConArchivo = MatchSoporteEgresoCliente & {
  file?: File;
};

export type ResumenEmpareje = {
  auto: number;
  duda: number;
  sin_match: number;
};

function fileDesdeOcr(
  m: Pick<
    OcrSoporteParaMatch,
    'archivoId' | 'adjuntoBase64' | 'adjuntoFileName' | 'adjuntoMime'
  >,
  byId: Map<string, File>,
): File | undefined {
  if (m.adjuntoBase64 && m.adjuntoFileName) {
    try {
      const bin = Uint8Array.from(atob(m.adjuntoBase64), (c) => c.charCodeAt(0));
      return new File([bin], m.adjuntoFileName, {
        type: m.adjuntoMime || 'application/pdf',
      });
    } catch {
      /* fallback */
    }
  }
  if (byId.has(m.archivoId)) return byId.get(m.archivoId);
  const origen = m.archivoId.split('#')[0];
  if (origen && byId.has(origen)) return byId.get(origen);
  return undefined;
}

async function ocrUnArchivo(archivo: ArchivoSoporteLocal): Promise<OcrSoporteParaMatch[]> {
  const form = new FormData();
  form.append('modo', 'ocr');
  form.append('soporte_ids', JSON.stringify([archivo.id]));
  form.append('soporte', archivo.file, archivo.file.name);

  const res = await fetch('/api/contabilidad/cco/emparejar-soportes', {
    method: 'POST',
    body: form,
  });
  const raw = await res.text();
  const json = parseRespuestaEmparejarSoportes(raw, res.status);
  if (!res.ok || !json.ok || !Array.isArray(json.matches)) {
    throw new Error(
      mensajeErrorEmparejarSoportes(
        json.error || `No se pudo leer «${archivo.file.name}».`,
      ),
    );
  }

  return (json.matches as OcrSoporteParaMatch[]).map((m) => ({
    archivoId: m.archivoId,
    fileName: m.fileName,
    leido: m.leido,
    motivo: m.motivo,
    error: m.error,
    paginas: m.paginas,
    adjuntoBase64: m.adjuntoBase64,
    adjuntoMime: m.adjuntoMime,
    adjuntoFileName: m.adjuntoFileName,
  }));
}

/**
 * OCR + empareje local. `onProgreso` recibe texto para la UI.
 */
export async function procesarLoteSoportesCliente(params: {
  archivos: ArchivoSoporteLocal[];
  egresos: EgresoCandidatoSoporte[];
  onProgreso?: (msg: string) => void;
}): Promise<{
  matches: MatchSoporteConArchivo[];
  resumen: ResumenEmpareje;
}> {
  const { archivos, egresos, onProgreso } = params;
  if (archivos.length === 0) {
    throw new Error('Seleccione PDFs o imágenes.');
  }
  if (egresos.length === 0) {
    throw new Error('No hay egresos sin factura en el cuadro filtrado.');
  }

  const ocrAcumulado: OcrSoporteParaMatch[] = [];
  const byId = new Map(archivos.map((a) => [a.id, a.file]));

  for (let i = 0; i < archivos.length; i++) {
    const a = archivos[i]!;
    onProgreso?.(`Leyendo ${i + 1}/${archivos.length}: ${a.file.name}`);
    const chunk = await ocrUnArchivo(a);
    ocrAcumulado.push(...chunk);
  }

  onProgreso?.(`Emparejando con ${egresos.length} egresos…`);
  const matched = emparejarOcrContraEgresosLocal(ocrAcumulado, egresos);
  const matches: MatchSoporteConArchivo[] = matched.map((m) => ({
    ...m,
    file: fileDesdeOcr(m, byId),
  }));

  const resumen: ResumenEmpareje = {
    auto: matches.filter((m) => m.decision === 'auto').length,
    duda: matches.filter((m) => m.decision === 'duda').length,
    sin_match: matches.filter((m) => m.decision === 'sin_match').length,
  };

  return { matches, resumen };
}

export function egresosDesdeFilasSinDoc(
  filas: Array<{
    id: string;
    proveedor: string;
    fecha: string | null;
    moneda: string;
    monto_orig: number;
    monto_base_usd: number;
    tasa: number;
    invoice_number?: string | null;
    display_id?: number | string;
  }>,
): EgresoCandidatoSoporte[] {
  return filas.map((f) => ({
    id: f.id,
    proveedor: f.proveedor,
    fecha: f.fecha,
    moneda: f.moneda,
    monto_orig: f.monto_orig,
    monto_base_usd: f.monto_base_usd,
    tasa: f.tasa,
    invoice_number: f.invoice_number,
    display_id: f.display_id,
  }));
}

export type { DecisionMatch };
