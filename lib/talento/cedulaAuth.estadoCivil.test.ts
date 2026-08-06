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

  it('conserva valor no vacío', () => {
    assert.equal(estadoCivilContratoObrero('Casado'), 'Casado');
    assert.equal(estadoCivilContratoObrero('soltera'), 'soltera');
  });

  it('hoja de vida gana sobre Soltero manual', () => {
    assert.equal(estadoCivilContratoObrero('Casada', 'Soltero'), 'Casada');
    assert.equal(estadoCivilContratoObrero(null, 'Soltero'), 'Soltero');
  });

  it('trabajadorFemeninoDesdeEstadoCivil', () => {
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('Soltero'), false);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('Soltera'), true);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil('Casada'), true);
    assert.equal(trabajadorFemeninoDesdeEstadoCivil(''), false);
  });
});
