import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { claveNormFaseTecnica, trimFaseTecnica } from '@/lib/talento/fasesTecnicasContrato';

describe('fasesTecnicasContrato', () => {
  it('claveNorm colapsa acentos y mayúsculas', () => {
    assert.equal(
      claveNormFaseTecnica('  Instalaciones Eléctricas, Sanitarias y de Gas  '),
      'instalaciones electricas, sanitarias y de gas',
    );
  });

  it('trimFaseTecnica rechaza vacío / corto', () => {
    assert.equal(trimFaseTecnica(null), null);
    assert.equal(trimFaseTecnica('  '), null);
    assert.equal(trimFaseTecnica('a'), null);
    assert.equal(trimFaseTecnica('  Acabados  '), 'Acabados');
  });
});
