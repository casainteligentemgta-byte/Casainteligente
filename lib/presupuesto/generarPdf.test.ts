import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { budgetPdfDataDesdeDocumento } from './pdfDatos';
import type { DocumentoPresupuestoCliente } from './documentoCliente';

const doc: DocumentoPresupuestoCliente = {
  id: '11111111-1111-4111-8111-111111111111',
  numero: 'P-501',
  fecha: '5 de marzo de 2026',
  cliente: 'María',
  rif: 'V-1',
  notas: 'Garantía',
  showZelle: true,
  items: [
    {
      nombre: 'Cámara',
      descripcion: 'Visión nocturna',
      qty: 2,
      unitPrice: 100,
      discount: 10,
      lineTotal: 180,
      descuentoUsd: 20,
    },
  ],
  subtotal: 180,
  descuentoTotal: 20,
  ivaPct: 16,
  ivaMonto: 28.8,
  totalConIva: 208.8,
  exento: false,
  tasaBcv: 40,
  tasaBcvFecha: '2026-03-05',
  totalBs: 8352,
};

describe('datos del PDF comercial', () => {
  it('copia descuentos, descripción, IVA y Bs; no lleva costos', () => {
    const data = budgetPdfDataDesdeDocumento(doc, { logoSrc: 'https://x/logo.png' });
    assert.equal(data.numero, 'P-501');
    assert.equal(data.items[0]!.descripcion, 'Visión nocturna');
    assert.equal(data.items[0]!.discount, 10);
    assert.equal(data.ivaPct, 16);
    assert.equal(data.totalConIva, 208.8);
    assert.equal(data.totalBs, 8352);
    assert.equal(data.logoSrc, 'https://x/logo.png');
    assert.equal('costo' in data.items[0]!, false);
    assert.equal('totalCost' in data, false);
    assert.equal('marginPct' in data, false);
  });
});
