/**
 * Tests: partir / unir PDF por páginas.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, rgb } from 'pdf-lib';
import {
  partirPdfPorPaginas,
  unirPdfPaginas,
} from './partirPdfPorPaginas';

async function pdfConPaginas(n: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) {
    const page = doc.addPage([200, 200]);
    page.drawText(`P${i + 1}`, { x: 40, y: 100, size: 18, color: rgb(0, 0, 0) });
  }
  return Buffer.from(await doc.save());
}

describe('partirPdfPorPaginas', () => {
  it('parte un PDF de 3 páginas en 3 PDFs', async () => {
    const buf = await pdfConPaginas(3);
    const pages = await partirPdfPorPaginas(buf);
    assert.equal(pages.length, 3);
    assert.equal(pages[0]!.pageNumber, 1);
    assert.equal(pages[2]!.pageNumber, 3);
    for (const p of pages) {
      const one = await PDFDocument.load(p.buffer);
      assert.equal(one.getPageCount(), 1);
    }
  });

  it('une páginas de nuevo', async () => {
    const buf = await pdfConPaginas(2);
    const pages = await partirPdfPorPaginas(buf);
    const merged = await unirPdfPaginas(pages.map((p) => p.buffer));
    const doc = await PDFDocument.load(merged);
    assert.equal(doc.getPageCount(), 2);
  });
});
