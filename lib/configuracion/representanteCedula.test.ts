/**
 * Ejecutar: npx tsx --test lib/configuracion/representanteCedula.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  edadDesdeFechaNacimiento,
  esCedulaVenezolana,
  letraCedula,
  nacionalidadDesdeCedula,
} from './representanteCedula';

describe('representanteCedula', () => {
  it('detecta V y E', () => {
    assert.equal(letraCedula('V1384818688'), 'V');
    assert.equal(letraCedula('v-12.345.678'), 'V');
    assert.equal(letraCedula('E12345678'), 'E');
    assert.equal(letraCedula('12345678'), null);
  });

  it('nacionalidad solo automática para V', () => {
    assert.equal(esCedulaVenezolana('V123'), true);
    assert.equal(nacionalidadDesdeCedula('V123'), 'Venezolano');
    assert.equal(nacionalidadDesdeCedula('E123'), null);
  });

  it('calcula edad desde fecha de nacimiento', () => {
    const hoy = new Date(2026, 6, 25); // 25 jul 2026
    assert.equal(edadDesdeFechaNacimiento('1979-03-10', hoy), '47');
    assert.equal(edadDesdeFechaNacimiento('2000-07-26', hoy), '25');
    assert.equal(edadDesdeFechaNacimiento('2000-07-25', hoy), '26');
    assert.equal(edadDesdeFechaNacimiento(''), '');
  });
});
