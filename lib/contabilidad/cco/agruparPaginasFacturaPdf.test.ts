/**
 * Tests: agrupar páginas consecutivas de la misma factura.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparPaginasMismaFactura,
  type CabeceraPaginaFactura,
} from './agruparPaginasFacturaPdf';

function p(over: Partial<CabeceraPaginaFactura> & { pageIndex: number }): CabeceraPaginaFactura {
  const n = over.pageNumber ?? over.pageIndex + 1;
  return {
    pageNumber: n,
    invoice_number: '',
    supplier_name: 'FERRETERIA X',
    supplier_rif: 'J-123',
    date: '2025-03-15',
    total_amount: null,
    ...over,
  };
}

describe('agruparPaginasMismaFactura', () => {
  it('una página → un grupo', () => {
    const g = agruparPaginasMismaFactura([
      p({ pageIndex: 0, invoice_number: 'A-1', total_amount: 100 }),
    ]);
    assert.equal(g.length, 1);
    assert.deepEqual(g[0]!.pageNumbers, [1]);
  });

  it('mismo nº en páginas consecutivas → un grupo', () => {
    const g = agruparPaginasMismaFactura([
      p({ pageIndex: 0, invoice_number: 'A-1', total_amount: null }),
      p({ pageIndex: 1, invoice_number: 'A-1', total_amount: 500 }),
    ]);
    assert.equal(g.length, 1);
    assert.deepEqual(g[0]!.pageNumbers, [1, 2]);
    assert.equal(g[0]!.cabecera.total_amount, 500);
  });

  it('números distintos → dos grupos', () => {
    const g = agruparPaginasMismaFactura([
      p({ pageIndex: 0, invoice_number: 'A-1', total_amount: 100 }),
      p({ pageIndex: 1, invoice_number: 'B-2', total_amount: 200 }),
    ]);
    assert.equal(g.length, 2);
  });

  it('continuación sin nº (mismo emisor) se agrupa', () => {
    const g = agruparPaginasMismaFactura([
      p({ pageIndex: 0, invoice_number: 'A-1', total_amount: 100 }),
      p({
        pageIndex: 1,
        invoice_number: '',
        total_amount: null,
        supplier_name: 'FERRETERIA X CA',
        supplier_rif: 'J-123',
      }),
    ]);
    assert.equal(g.length, 1);
    assert.deepEqual(g[0]!.pageNumbers, [1, 2]);
  });

  it('mismo proveedor pero otro total y fecha → grupos distintos', () => {
    const g = agruparPaginasMismaFactura([
      p({ pageIndex: 0, invoice_number: 'A-1', total_amount: 100, date: '2025-01-01' }),
      p({
        pageIndex: 1,
        invoice_number: '',
        total_amount: 999,
        date: '2025-06-01',
        supplier_rif: 'J-123',
      }),
    ]);
    assert.equal(g.length, 2);
  });
});
