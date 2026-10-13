/**
 * Tests: número fijo de presupuesto.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { correlativoDesdeValor, etiquetaNumeroPresupuesto } from './numero';

describe('correlativoDesdeValor', () => {
  it('acepta number y string numérico', () => {
    assert.equal(correlativoDesdeValor(512), 512);
    assert.equal(correlativoDesdeValor('513'), 513);
  });

  it('rechaza basura', () => {
    assert.equal(correlativoDesdeValor(null), null);
    assert.equal(correlativoDesdeValor('abc'), null);
    assert.equal(correlativoDesdeValor(NaN), null);
  });
});

describe('etiquetaNumeroPresupuesto', () => {
  it('prioriza correlativo fijo', () => {
    assert.equal(etiquetaNumeroPresupuesto({ numero_correlativo: 500, id: 'uuid-largo-aqui' }), 'P-500');
  });

  it('usa fallback de orden solo si no hay correlativo', () => {
    assert.equal(etiquetaNumeroPresupuesto({ id: 'abc' }, { fallback: 501 }), 'P-501');
  });

  it('borrador para presupuesto aún no guardado', () => {
    assert.equal(etiquetaNumeroPresupuesto({}, { borrador: true }), 'P—(borrador)');
  });
});
