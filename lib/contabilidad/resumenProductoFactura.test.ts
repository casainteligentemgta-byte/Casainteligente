import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  etiquetaProductoFactura,
  resumenProductoFactura,
} from './resumenProductoFactura';

describe('resumenProductoFactura', () => {
  it('usa la primera descripción y cuenta el resto como extra', () => {
    const r = resumenProductoFactura([
      { descripcion: 'Cámara IP 4MP' },
      { descripcion: 'Cable UTP' },
      { descripcion: 'Fuente 12V' },
    ]);
    assert.equal(r.primera, 'Cámara IP 4MP');
    assert.equal(r.total, 3);
    assert.equal(r.extra, 2);
    assert.equal(etiquetaProductoFactura(r), 'Cámara IP 4MP');
  });

  it('sin líneas usa el countHint y no inventa descripción', () => {
    const r = resumenProductoFactura([], 4);
    assert.equal(r.primera, '');
    assert.equal(r.total, 4);
    assert.equal(r.extra, 0);
    assert.equal(etiquetaProductoFactura(r), '4 productos');
  });

  it('una sola línea no muestra extra', () => {
    const r = resumenProductoFactura([{ descripcion: 'Sensor PIR' }]);
    assert.equal(r.extra, 0);
    assert.equal(etiquetaProductoFactura(r), 'Sensor PIR');
  });
});
