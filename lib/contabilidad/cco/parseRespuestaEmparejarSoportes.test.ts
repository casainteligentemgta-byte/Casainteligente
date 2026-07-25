/**
 * Ejecutar: npx tsx --test lib/contabilidad/cco/parseRespuestaEmparejarSoportes.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mensajeErrorEmparejarSoportes,
  parseRespuestaEmparejarSoportes,
} from './parseRespuestaEmparejarSoportes';

describe('parseRespuestaEmparejarSoportes', () => {
  it('parsea JSON OK', () => {
    const r = parseRespuestaEmparejarSoportes(
      JSON.stringify({ ok: true, matches: [], resumen: { auto: 0, duda: 0, sin_match: 0 } }),
      200,
    );
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.matches));
  });

  it('rechaza HTML de timeout Vercel con mensaje claro', () => {
    assert.throws(
      () =>
        parseRespuestaEmparejarSoportes(
          '<!DOCTYPE html><html><body>An error occurred</body></html>',
          504,
        ),
      /no terminó a tiempo|PDF grande/i,
    );
  });

  it('rechaza cuerpo vacío en 502', () => {
    assert.throws(
      () => parseRespuestaEmparejarSoportes('', 502),
      /cortó la carga|502/i,
    );
  });
});

describe('mensajeErrorEmparejarSoportes', () => {
  it('traduce el error genérico de Safari', () => {
    const msg = mensajeErrorEmparejarSoportes(
      new Error('The string did not match the expected pattern.'),
    );
    assert.match(msg, /No se pudo leer la respuesta|PDF multipágina/i);
  });
});
