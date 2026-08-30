import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  domicilioContratoObrero,
  estadoCivilContratoObrero,
  nacionalidadDesdeCedula,
  trabajadorFemeninoDesdeEstadoCivil,
} from '@/lib/talento/cedulaAuth';

describe('nacionalidadDesdeCedula / estadoCivilContratoObrero', () => {
  it('V → venezolano (ciudadano), E → extranjero; femenino → -a', () => {
    assert.equal(nacionalidadDesdeCedula('V-18296258'), 'venezolano');
    assert.equal(nacionalidadDesdeCedula('V18296258', false), 'venezolano');
    assert.equal(nacionalidadDesdeCedula('V18296258', true), 'venezolana');
    assert.equal(nacionalidadDesdeCedula('10.199.713'), null);
    assert.equal(nacionalidadDesdeCedula('E-81234567'), 'extranjero');
    assert.equal(nacionalidadDesdeCedula('e1234567', true), 'extranjera');
  });

  it('estado civil vacío → Soltero', () => {
    assert.equal(estadoCivilContratoObrero(null), 'Soltero');
    assert.equal(estadoCivilContratoObrero(''), 'Soltero');
    assert.equal(estadoCivilContratoObrero('  '), 'Soltero');
    assert.equal(estadoCivilContratoObrero('casado'), 'casado');
  });

  it('domicilio vacío → de este domicilio', () => {
    assert.equal(domicilioContratoObrero(null), 'de este domicilio');
    assert.equal(domicilioContratoObrero(''), 'de este domicilio');
    assert.equal(domicilioContratoObrero('  '), 'de este domicilio');
    assert.equal(domicilioContratoObrero('Calle 1, Porlamar'), 'Calle 1, Porlamar');
  });

  it('trabajadorFemeninoDesdeEstadoCivil', () => {
    assert.equal(trabajadorFemeninoDesdeEstadoCivil(null), false);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('Soltero'), false);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('Casado'), false);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('Soltera'), true);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('casada'), true);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('Viuda'), true);
  });
});
