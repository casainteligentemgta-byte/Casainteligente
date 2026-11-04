import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  descuentoLineaUsd,
  esErrorColumnaIva,
  esExentoIva,
  etiquetaIva,
  ivaMontoDe,
  IVA_PCT_DEFAULT,
  normalizarIvaPct,
  totalConIvaDe,
  totalReferencialBs,
} from './iva';

describe('IVA del presupuesto', () => {
  it('por defecto es 16 % y 0 es exento', () => {
    assert.equal(IVA_PCT_DEFAULT, 16);
    assert.equal(normalizarIvaPct(undefined), 16);
    assert.equal(normalizarIvaPct(null), 16);
    assert.equal(normalizarIvaPct(0), 0);
    assert.equal(esExentoIva(0), true);
    assert.equal(esExentoIva(16), false);
  });

  it('calcula monto y total con IVA', () => {
    assert.equal(ivaMontoDe(1000, 16), 160);
    assert.equal(totalConIvaDe(1000, 16), 1160);
    assert.equal(ivaMontoDe(1000, 0), 0);
    assert.equal(totalConIvaDe(1000, 0), 1000);
    assert.equal(ivaMontoDe(99.99, 16), 16);
  });

  it('etiqueta y descuento de línea', () => {
    assert.equal(etiquetaIva(16), 'IVA (16%)');
    assert.equal(etiquetaIva(0), 'IVA (exento)');
    assert.equal(descuentoLineaUsd(100, 10, 2), 20);
    assert.equal(descuentoLineaUsd(50, 0, 3), 0);
  });

  it('equivalente referencial en Bs', () => {
    assert.equal(totalReferencialBs(1160, 36.5), 42340);
    assert.equal(totalReferencialBs(100, 0), null);
  });

  it('detecta error de columna IVA ausente', () => {
    assert.equal(esErrorColumnaIva("Could not find the 'iva_pct' column of 'budgets'"), true);
    assert.equal(esErrorColumnaIva('duplicate key'), false);
  });
});
