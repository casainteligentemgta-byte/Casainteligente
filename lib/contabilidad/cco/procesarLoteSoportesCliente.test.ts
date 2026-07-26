/**
 * Ejecutar: npx tsx --test lib/contabilidad/cco/procesarLoteSoportesCliente.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, rgb } from 'pdf-lib';
import { agruparPaginasMismaFactura } from './agruparPaginasFacturaPdf';
import { egresosDesdeFilasSinDoc } from './procesarLoteSoportesCliente';
import {
  contarPaginasPdf,
  extraerRangoPdf,
  PAGINAS_POR_LOTE_OCR,
} from './partirPdfCliente';

async function pdfFileConPaginas(n: number): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) {
    const page = doc.addPage([200, 200]);
    page.drawText(`P${i + 1}`, { x: 40, y: 100, size: 18, color: rgb(0, 0, 0) });
  }
  const bytes = new Uint8Array(await doc.save());
  return new File([bytes], 'lote-facturas.pdf', { type: 'application/pdf' });
}

describe('procesarLoteSoportesCliente', () => {
  it('mapea filas del cuadro a candidatos de match', () => {
    const egresos = egresosDesdeFilasSinDoc([
      {
        id: 'c1',
        proveedor: 'ACME',
        fecha: '2026-03-01',
        moneda: 'USD',
        monto_orig: 10,
        monto_base_usd: 10,
        tasa: 1,
        invoice_number: '1',
        display_id: 99,
      },
    ]);
    assert.equal(egresos.length, 1);
    assert.equal(egresos[0]!.id, 'c1');
    assert.equal(egresos[0]!.proveedor, 'ACME');
    assert.equal(egresos[0]!.display_id, 99);
  });

  it('trocea PDF multipágina (varias facturas) en lotes de páginas', async () => {
    assert.ok(PAGINAS_POR_LOTE_OCR >= 1);
    const file = await pdfFileConPaginas(7);
    assert.equal(await contarPaginasPdf(file), 7);
    const slice = await extraerRangoPdf(file, 3, 5);
    assert.equal(await contarPaginasPdf(slice), 3);
  });

  it('agrupa páginas de la misma factura y separa otras', () => {
    const g = agruparPaginasMismaFactura([
      {
        pageIndex: 0,
        pageNumber: 1,
        invoice_number: 'A-1',
        supplier_name: 'Proveedor Uno',
        supplier_rif: 'J1',
        date: '2026-03-01',
        total_amount: 100,
      },
      {
        pageIndex: 1,
        pageNumber: 2,
        invoice_number: 'A-1',
        supplier_name: 'Proveedor Uno',
        supplier_rif: 'J1',
        date: '2026-03-01',
        total_amount: null,
      },
      {
        pageIndex: 2,
        pageNumber: 3,
        invoice_number: 'B-2',
        supplier_name: 'Otro',
        supplier_rif: 'J2',
        date: '2026-03-02',
        total_amount: 50,
      },
    ]);
    assert.equal(g.length, 2);
    assert.deepEqual(g[0]!.pageNumbers, [1, 2]);
    assert.deepEqual(g[1]!.pageNumbers, [3]);
  });
});
