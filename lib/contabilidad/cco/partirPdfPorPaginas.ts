/**
 * Parte un PDF en páginas sueltas y une páginas en un PDF (Node).
 */

import { PDFDocument } from 'pdf-lib';

export const MAX_PAGINAS_POR_PDF = 20;

export type PdfPagina = {
  /** Índice 0-based en el PDF original. */
  pageIndex: number;
  /** Número de página 1-based (UI). */
  pageNumber: number;
  buffer: Buffer;
};

/**
 * Extrae cada página como un PDF de una sola página.
 */
export async function partirPdfPorPaginas(
  buffer: Buffer,
  opts?: { maxPaginas?: number },
): Promise<PdfPagina[]> {
  const max = opts?.maxPaginas ?? MAX_PAGINAS_POR_PDF;
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (total <= 0) {
    throw new Error('El PDF no tiene páginas legibles.');
  }
  if (total > max) {
    throw new Error(
      `El PDF tiene ${total} páginas (máx. ${max} por archivo). Divídalo o suba por lotes.`,
    );
  }

  const out: PdfPagina[] = [];
  for (let i = 0; i < total; i++) {
    const doc = await PDFDocument.create();
    const [copied] = await doc.copyPages(src, [i]);
    doc.addPage(copied);
    const bytes = await doc.save();
    out.push({
      pageIndex: i,
      pageNumber: i + 1,
      buffer: Buffer.from(bytes),
    });
  }
  return out;
}

/** Une varios PDFs (p. ej. páginas consecutivas de la misma factura). */
export async function unirPdfPaginas(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) {
    throw new Error('No hay páginas para unir.');
  }
  if (buffers.length === 1) return buffers[0]!;

  const out = await PDFDocument.create();
  for (const b of buffers) {
    const src = await PDFDocument.load(b, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return Buffer.from(await out.save());
}

export function esPdfMime(mime: string, fileName?: string): boolean {
  const t = (mime || '').toLowerCase();
  if (t === 'application/pdf') return true;
  return Boolean(fileName && fileName.toLowerCase().endsWith('.pdf'));
}
