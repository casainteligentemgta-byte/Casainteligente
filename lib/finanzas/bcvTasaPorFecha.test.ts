import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { etiquetaFuenteTasaBcv } from './bcvTasaPorFecha';

describe('fuente de tasa BCV', () => {
  it('ya no ofrece etiqueta de fallback 36.5', () => {
    assert.equal(etiquetaFuenteTasaBcv('fallback').includes('36.5'), false);
    assert.equal(etiquetaFuenteTasaBcv('env'), 'Variable NEXT_PUBLIC_TASA_BCV_VES_POR_USD');
  });
});
