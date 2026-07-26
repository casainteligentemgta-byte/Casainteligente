/**
 * Partir / unir PDFs en el navegador (pdf-lib).
 * Permite leer un PDF con muchas facturas por rangos sin saturar Vercel.
 */

import { PDFDocument } from 'pdf-lib';

/** Páginas por request OCR (varias facturas en un PDF semanal). */
export const PAGINAS_POR_LOTE_OCR = 5;

/** Tope razonable de páginas por archivo en el cliente. */
export const MAX_PAGINAS_PDF_CLIENTE = 60;

export async function contarPaginasPdf(file: File): Promise<number> {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return src.getPageCount();
}

/** Extrae páginas 1-based inclusive como un PDF nuevo. */
export async function extraerRangoPdf(
  file: File,
  paginaDesde: number,
  paginaHasta: number,
): Promise<File> {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const from = Math.max(1, Math.min(paginaDesde, total));
  const to = Math.max(from, Math.min(paginaHasta, total));

  const out = await PDFDocument.create();
  const indices = [];
  for (let p = from; p <= to; p++) indices.push(p - 1);
  const copied = await out.copyPages(src, indices);
  for (const page of copied) out.addPage(page);
  const saved = new Uint8Array(await out.save());
  const name = file.name.replace(/\.pdf$/i, '') || 'factura';
  return new File([saved], `${name}_p${from}-${to}.pdf`, {
    type: 'application/pdf',
  });
}

/** Une PDFs de una página (o más) en orden. */
export async function unirPdfsCliente(files: File[], fileName: string): Promise<File> {
  if (files.length === 0) throw new Error('No hay páginas para unir.');
  if (files.length === 1) {
    const f = files[0]!;
    return new File([await f.arrayBuffer()], fileName, {
      type: 'application/pdf',
    });
  }
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(await f.arrayBuffer(), {
      ignoreEncryption: true,
    });
    const copied = await out.copyPages(src, src.getPageIndices());
    for (const p of copied) out.addPage(p);
  }
  const saved = new Uint8Array(await out.save());
  return new File([saved], fileName, { type: 'application/pdf' });
}

export function esPdfFile(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}
