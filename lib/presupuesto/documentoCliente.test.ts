import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  documentoDesdeBudget,
  itemDocumentoDesdeJson,
  quitarCostos,
} from './documentoCliente';

describe('documento del cliente', () => {
  it('quita costos y margen de cualquier objeto', () => {
    const limpio = quitarCostos({
      nombre: 'Cámara',
      costo: 40,
      utilidad: 12,
      total_cost: 99,
      marginPct: 20,
      items: [{ nombre: 'x', costo: 1, qty: 2 }],
    }) as Record<string, unknown>;
    assert.equal(limpio.nombre, 'Cámara');
    assert.equal('costo' in limpio, false);
    assert.equal('utilidad' in limpio, false);
    assert.equal('total_cost' in limpio, false);
    const items = limpio.items as Array<Record<string, unknown>>;
    assert.equal('costo' in items[0]!, false);
    assert.equal(items[0]!.qty, 2);
  });

  it('conserva descripción y descuento; no copia costo', () => {
    const it = itemDocumentoDesdeJson({
      qty: 2,
      unit_price: 100,
      discount: 10,
      product_data: { nombre: 'CÁMARA IP', descripcion: 'visión nocturna', costo: 40, utilidad: 8 },
    });
    assert.equal(it.nombre, 'Cámara ip');
    assert.equal(it.descripcion, 'Visión nocturna');
    assert.equal(it.lineTotal, 180);
    assert.equal(it.descuentoUsd, 20);
    assert.equal('costo' in it, false);
  });

  it('arma totales con IVA y Bs, sin costos', () => {
    const doc = documentoDesdeBudget(
      {
        id: '11111111-1111-4111-8111-111111111111',
        customer_name: 'María',
        customer_rif: 'V-1',
        subtotal: 1000,
        iva_pct: 16,
        numero_correlativo: 501,
        fecha: '2026-03-05',
        notes: 'Garantía 1 año',
        total_cost: 400,
        items: [
          {
            qty: 1,
            unit_price: 1000,
            discount: 0,
            product_data: { nombre: 'Kit', descripcion: 'instalación', costo: 400 },
          },
        ],
      },
      { tasaBcv: 40, tasaBcvFecha: '2026-03-05', telefono: '04141234567' },
    );
    assert.equal(doc.numero, 'P-501');
    assert.equal(doc.ivaPct, 16);
    assert.equal(doc.ivaMonto, 160);
    assert.equal(doc.totalConIva, 1160);
    assert.equal(doc.totalBs, 46400);
    assert.equal(doc.items[0]!.descripcion, 'Instalación');
    assert.equal('total_cost' in doc, false);
    assert.equal('costo' in doc.items[0]!, false);
    assert.match(JSON.stringify(doc), /04141234567/);
    assert.doesNotMatch(JSON.stringify(doc), /"costo"|total_cost|margen/i);
  });
});
