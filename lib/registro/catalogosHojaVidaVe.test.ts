/**
 * Ejecutar: npx tsx --test lib/registro/catalogosHojaVidaVe.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  composeCedulaHv,
  composeCelularVe,
  parseCedulaHv,
  parseCelularVe,
} from './catalogosHojaVidaVe';

describe('catalogosHojaVidaVe', () => {
  it('arma y lee cédula V/E', () => {
    assert.deepEqual(parseCedulaHv(''), { letra: 'V', numero: '' });
    assert.deepEqual(parseCedulaHv('V-13.348.186'), { letra: 'V', numero: '13348186' });
    assert.deepEqual(parseCedulaHv('e12345678'), { letra: 'E', numero: '12345678' });
    assert.equal(composeCedulaHv('V', '13348186'), 'V-13348186');
    assert.equal(composeCedulaHv('E', ''), '');
  });

  it('arma y lee celular con prefijo venezolano', () => {
    assert.deepEqual(parseCelularVe('04141234567'), { prefijo: '0414', numero: '1234567' });
    assert.deepEqual(parseCelularVe('584241112233'), { prefijo: '0424', numero: '1112233' });
    assert.equal(composeCelularVe('0412', '5556677'), '04125556677');
    assert.equal(composeCelularVe('0416', ''), '0416');
  });
});
