import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estadoCivilContratoObrero,
  trabajadorFemeninoDesdeEstadoCivil,
} from '@/lib/talento/cedulaAuth';

describe('estadoCivilContratoObrero', () => {
  it('vacío → Soltero', () => {
    assert.equal(estadoCivilContratoObrero(null), 'Soltero');
    assert.equal(estadoCivilContratoObrero(''), 'Soltero');
    assert.equal(estadoCivilContratoObrero('  '), 'Soltero');
  });

  it('respeta valor existente', () => {
    assert.equal(estadoCivilContratoObrero('Casado'), 'Casado');
    assert.equal(estadoCivilContratoObrero('soltera'), 'soltera');
  });

  it('trabajadorFemeninoDesdeEstadoCivil', () => {
    assert.equal(trabajadorFemeninoDesdeEstadoCivil(null), false);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('Soltero'), false);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('Soltera'), true);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('casada'), true);
  });
});
