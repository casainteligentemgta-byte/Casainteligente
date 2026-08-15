/**
 * Tests: densidad del PDF de presupuesto (una hoja A4).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sheetModifierForItemCount } from './fitPrintOnePage';
import { buildPresupuestoPrintHtml, sanitizeBudgetItemsForPrint } from './html-impresion';

describe('sheetModifierForItemCount', () => {
  it('pocos ítems → sin modificador', () => {
    assert.equal(sheetModifierForItemCount(0), '');
    assert.equal(sheetModifierForItemCount(7), '');
  });

  it('más de 7 → compact', () => {
    assert.equal(sheetModifierForItemCount(8), ' sheet--compact');
  });

  it('más de 14 → compact + many', () => {
    assert.equal(sheetModifierForItemCount(15), ' sheet--compact sheet--many');
  });

  it('más de 22 → ultra', () => {
    assert.equal(sheetModifierForItemCount(23), ' sheet--compact sheet--many sheet--ultra');
  });
});

describe('buildPresupuestoPrintHtml', () => {
  it('incluye script de ajuste a una página y clase de densidad', () => {
    const items = Array.from({ length: 16 }, (_, i) => ({
      qty: 1,
      unit_price: 10,
      discount: 0,
      product_data: { nombre: `Producto ${i + 1}` },
    }));
    const html = buildPresupuestoPrintHtml({
      customer_name: 'Cliente Demo',
      customer_rif: 'J-1',
      subtotal: 160,
      items,
      numero_correlativo: 501,
    });
    assert.match(html, /sheet--compact sheet--many/);
    assert.match(html, /beforeprint/);
    assert.match(html, /@page \{\s*size: A4 portrait/);
    assert.match(html, /page-break-inside:\s*avoid/);
  });

  it('sanitize quita campos no imprimibles', () => {
    const out = sanitizeBudgetItemsForPrint([
      {
        qty: 2,
        unit_price: 5,
        discount: 0,
        product_data: { nombre: 'Cable', imagen: 'http://x/a.png' },
        imagen: 'http://x/b.png',
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.product_data?.nombre, 'Cable');
    assert.equal(out[0]!.qty, 2);
    assert.equal((out[0] as { imagen?: unknown }).imagen, undefined);
  });
});
