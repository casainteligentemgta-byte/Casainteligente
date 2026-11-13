import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MENSAJE_ERROR_NOTA_ENTREGA,
  NOTA_ENTREGA_KIND,
  aplicarMarcaNotaEntrega,
  documentoDiceNotaEntrega,
  esNotaEntregaCanal,
  notaEntregaDatosCompletos,
  prepararExtractedNotaEntrega,
  preciosDocumentoEnCero,
} from './notaEntregaCanal';

describe('detección de nota de entrega', () => {
  test('el mensaje de revisión es el texto genérico exacto', () => {
    assert.equal(
      MENSAJE_ERROR_NOTA_ENTREGA,
      'Atención: Nota de entrega. Cargar datos: proveedor, RIF, entidad, obra. No coloca precios.',
    );
  });

  test('document_kind nota_entrega o nota_entrega_telegram', () => {
    assert.equal(esNotaEntregaCanal({ document_kind: 'nota_entrega' }), true);
    assert.equal(esNotaEntregaCanal({ document_kind: NOTA_ENTREGA_KIND }), true);
    assert.equal(esNotaEntregaCanal({ document_kind: 'factura', total_amount: 10 }), false);
  });

  test('el documento dice nota de entrega aunque haya precios', () => {
    assert.equal(
      documentoDiceNotaEntrega({ invoice_number: 'Nota de Entrega 12', total_amount: 80 }),
      true,
    );
    assert.equal(esNotaEntregaCanal({ invoice_number: 'NOTA DE ENTREGA', total_amount: 80 }), true);
  });

  test('sin precios o todos en 0 es nota de entrega', () => {
    assert.equal(preciosDocumentoEnCero({ items: [] }), true);
    assert.equal(preciosDocumentoEnCero({ total_amount: 0, items: [{ unit_price: 0 }] }), true);
    assert.equal(esNotaEntregaCanal({ supplier_name: 'Acme', items: [{ unit_price: 0 }] }), true);
    assert.equal(
      esNotaEntregaCanal({
        document_kind: 'factura',
        total_amount: 12,
        items: [{ unit_price: 12 }],
      }),
      false,
    );
  });

  test('marcar extracted reusa el kind existente y deja factura pendiente', () => {
    const marked = aplicarMarcaNotaEntrega({ invoice_number: 'NE-1', total_amount: 0 });
    assert.equal(marked.document_kind, NOTA_ENTREGA_KIND);
    assert.equal(marked.factura_pendiente, true);
  });

  test('prepararExtractedNotaEntrega pone revisión y el mensaje exacto', () => {
    const r = prepararExtractedNotaEntrega({ total_amount: 0, items: [] });
    assert.equal(r.esNota, true);
    assert.equal(r.requiere_revision, true);
    assert.equal(r.mensaje_error, MENSAJE_ERROR_NOTA_ENTREGA);
    assert.equal(r.extracted.document_kind, NOTA_ENTREGA_KIND);
  });

  test('factura con precios no se marca', () => {
    const r = prepararExtractedNotaEntrega({
      document_kind: 'factura',
      total_amount: 40,
      items: [{ unit_price: 40 }],
    });
    assert.equal(r.esNota, false);
    assert.equal(r.requiere_revision, false);
    assert.equal(r.mensaje_error, null);
  });
});

describe('datos completos de nota de entrega', () => {
  test('exige proveedor, RIF, entidad y obra; no precios', () => {
    const extracted = { supplier_name: 'Acme', supplier_rif: 'J-1' };
    assert.equal(notaEntregaDatosCompletos(extracted, { entidad_id: 'e', proyecto_id: 'p' }), true);
    assert.equal(notaEntregaDatosCompletos(extracted, { entidad_id: 'e', proyecto_id: null }), false);
    assert.equal(
      notaEntregaDatosCompletos({ supplier_name: 'Acme' }, { entidad_id: 'e', proyecto_id: 'p' }),
      false,
    );
  });
});
