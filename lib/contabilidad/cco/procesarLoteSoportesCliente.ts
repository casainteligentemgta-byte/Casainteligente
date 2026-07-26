/**
 * Flujo cliente del agente de soportes:
 * 1) PDF con varias facturas → trocea por páginas, OCR por lotes
 * 2) Agrupa páginas de la misma factura
 * 3) Match local contra el cuadro de egresos
 */

import {
  agruparPaginasMismaFactura,
  type CabeceraPaginaFactura,
} from '@/lib/contabilidad/cco/agruparPaginasFacturaPdf';
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
import {
  contarPaginasPdf,
  esPdfFile,
  extraerRangoPdf,
  MAX_PAGINAS_PDF_CLIENTE,
  PAGINAS_POR_LOTE_OCR,
  unirPdfsCliente,
} from '@/lib/contabilidad/cco/partirPdfCliente';

export type ArchivoSoporteLocal = { id: string; file: File };

export type MatchSoporteConArchivo = MatchSoporteEgresoCliente & {
  file?: File;
};

export type ResumenEmpareje = {
  auto: number;
  duda: number;
  sin_match: number;
};

type PaginaOcr = {
  origenId: string;
  origenName: string;
  pageNumber: number;
  leido: OcrSoporteParaMatch['leido'];
  error?: string;
  pageFile: File;
};

async function ocrUnArchivo(
  archivo: ArchivoSoporteLocal,
  opts?: { porPagina?: boolean },
): Promise<OcrSoporteParaMatch[]> {
  const form = new FormData();
  form.append('modo', 'ocr');
  form.append('por_pagina', opts?.porPagina === false ? '0' : '1');
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

function fileDesdeBase64(
  base64: string | undefined,
  fileName: string | undefined,
  mime: string | undefined,
): File | undefined {
  if (!base64 || !fileName) return undefined;
  try {
    const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new File([bin], fileName, { type: mime || 'application/pdf' });
  } catch {
    return undefined;
  }
}

/**
 * Lee un PDF (posiblemente con muchas facturas) por lotes de páginas.
 */
async function ocrPdfMultipagina(
  archivo: ArchivoSoporteLocal,
  onProgreso?: (msg: string) => void,
): Promise<PaginaOcr[]> {
  const total = await contarPaginasPdf(archivo.file);
  if (total <= 0) {
    throw new Error(`«${archivo.file.name}» no tiene páginas legibles.`);
  }
  if (total > MAX_PAGINAS_PDF_CLIENTE) {
    throw new Error(
      `«${archivo.file.name}» tiene ${total} páginas (máx. ${MAX_PAGINAS_PDF_CLIENTE}). Divídalo en partes.`,
    );
  }

  const paginas: PaginaOcr[] = [];

  for (let desde = 1; desde <= total; desde += PAGINAS_POR_LOTE_OCR) {
    const hasta = Math.min(desde + PAGINAS_POR_LOTE_OCR - 1, total);
    onProgreso?.(
      `PDF «${archivo.file.name}»: páginas ${desde}–${hasta} de ${total}`,
    );

    const slice = await extraerRangoPdf(archivo.file, desde, hasta);
    const sliceId = `${archivo.id}#r${desde}-${hasta}`;
    const ocrs = await ocrUnArchivo({ id: sliceId, file: slice }, { porPagina: true });

    for (const m of ocrs) {
      // Páginas del slice vienen como 1..n → remapear al PDF original
      const localPage = m.paginas?.[0] ?? 1;
      const pageNumber = desde + localPage - 1;
      const pageFile =
        fileDesdeBase64(m.adjuntoBase64, m.adjuntoFileName, m.adjuntoMime) ||
        (await extraerRangoPdf(archivo.file, pageNumber, pageNumber));

      paginas.push({
        origenId: archivo.id,
        origenName: archivo.file.name,
        pageNumber,
        leido: m.leido,
        error: m.error,
        pageFile,
      });
    }
  }

  paginas.sort((a, b) => a.pageNumber - b.pageNumber);
  return paginas;
}

async function facturasDesdePaginasPdf(
  paginas: PaginaOcr[],
): Promise<Array<OcrSoporteParaMatch & { file?: File }>> {
  const ok = paginas.filter((p) => !p.error);
  const err = paginas.filter((p) => p.error);
  const out: Array<OcrSoporteParaMatch & { file?: File }> = [];

  for (const e of err) {
    out.push({
      archivoId: `${e.origenId}#p${e.pageNumber}`,
      fileName: `${e.origenName} · p.${e.pageNumber}`,
      leido: {
        invoice_number: '',
        supplier_name: '',
        supplier_rif: '',
        fecha: '',
        total_amount: null,
      },
      motivo: 'Error OCR en página',
      error: e.error,
      paginas: [e.pageNumber],
      file: e.pageFile,
    });
  }

  if (ok.length === 0) return out;

  const cabeceras: CabeceraPaginaFactura[] = ok.map((p) => ({
    pageIndex: p.pageNumber - 1,
    pageNumber: p.pageNumber,
    invoice_number: p.leido.invoice_number,
    supplier_name: p.leido.supplier_name,
    supplier_rif: p.leido.supplier_rif,
    date: p.leido.fecha,
    total_amount: p.leido.total_amount,
  }));

  const grupos = agruparPaginasMismaFactura(cabeceras);
  const byPage = new Map(ok.map((p) => [p.pageNumber, p]));

  for (const g of grupos) {
    const pages = g.pageNumbers
      .map((n) => byPage.get(n))
      .filter((p): p is PaginaOcr => Boolean(p));
    if (pages.length === 0) continue;

    const etiqueta =
      g.pageNumbers.length === 1
        ? `p.${g.pageNumbers[0]}`
        : `p.${g.pageNumbers[0]}–${g.pageNumbers[g.pageNumbers.length - 1]}`;

    const origen = pages[0]!;
    const fileName = `${origen.origenName} · ${etiqueta}`;
    const adjuntoName = `${origen.origenName.replace(/\.pdf$/i, '')}_${etiqueta.replace(/[–.]/g, '_')}.pdf`;
    const file = await unirPdfsCliente(
      pages.map((p) => p.pageFile),
      adjuntoName,
    );

    const cab = g.cabecera;
    out.push({
      archivoId: `${origen.origenId}#${etiqueta.replace(/\s/g, '')}`,
      fileName,
      leido: {
        invoice_number: cab.invoice_number || '',
        supplier_name: cab.supplier_name || '',
        supplier_rif: cab.supplier_rif || '',
        fecha: cab.date || '',
        total_amount: cab.total_amount,
      },
      paginas: g.pageNumbers,
      file,
    });
  }

  return out;
}

/**
 * OCR + empareje local. Un PDF puede traer varias facturas (1+ páginas c/u).
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

  const ocrParaMatch: Array<OcrSoporteParaMatch & { file?: File }> = [];

  for (let i = 0; i < archivos.length; i++) {
    const a = archivos[i]!;

    if (esPdfFile(a.file)) {
      onProgreso?.(`Preparando PDF ${i + 1}/${archivos.length}: ${a.file.name}`);
      const paginas = await ocrPdfMultipagina(a, onProgreso);
      onProgreso?.(
        `Agrupando facturas en «${a.file.name}» (${paginas.length} página(s))…`,
      );
      const facturas = await facturasDesdePaginasPdf(paginas);
      ocrParaMatch.push(...facturas);
      continue;
    }

    onProgreso?.(`Leyendo imagen ${i + 1}/${archivos.length}: ${a.file.name}`);
    const ocrs = await ocrUnArchivo(a, { porPagina: false });
    for (const m of ocrs) {
      ocrParaMatch.push({
        ...m,
        file:
          fileDesdeBase64(m.adjuntoBase64, m.adjuntoFileName, m.adjuntoMime) ||
          a.file,
      });
    }
  }

  onProgreso?.(`Emparejando ${ocrParaMatch.length} factura(s) con ${egresos.length} egresos…`);
  const matched = emparejarOcrContraEgresosLocal(ocrParaMatch, egresos);

  const byArchivoId = new Map(
    ocrParaMatch.map((o) => [o.archivoId, o.file] as const),
  );
  const matches: MatchSoporteConArchivo[] = matched.map((m) => ({
    ...m,
    file: byArchivoId.get(m.archivoId),
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
