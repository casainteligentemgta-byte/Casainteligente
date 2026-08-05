import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estadoCivilContratoObrero,
  nacionalidadDesdeCedula,
} from '@/lib/talento/cedulaAuth';

describe('nacionalidadDesdeCedula / estadoCivilContratoObrero', () => {
  it('V → venezolanas, E → extranjeras (forma genérica)', () => {
    assert.equal(nacionalidadDesdeCedula('V-18296258'), 'venezolanas');
    assert.equal(nacionalidadDesdeCedula('V18296258'), 'venezolanas');
    assert.equal(nacionalidadDesdeCedula('10.199.713'), null);
    assert.equal(nacionalidadDesdeCedula('E-81234567'), 'extranjeras');
    assert.equal(nacionalidadDesdeCedula('e1234567'), 'extranjeras');
  });

  it('estado civil vacío → Soltero', () => {
    assert.equal(estadoCivilContratoObrero(null), 'Soltero');
    assert.equal(estadoCivilContratoObrero(''), 'Soltero');
    assert.equal(estadoCivilContratoObrero('  '), 'Soltero');
    assert.equal(estadoCivilContratoObrero('casado'), 'casado');
  });
});
