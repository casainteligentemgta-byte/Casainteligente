/**
 * Ejecutar: npx tsx --test lib/talento/expedienteCedula.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cedulaNormExpediente, expedienteDesdeCedula } from './expedienteCedula';

describe('expedienteDesdeCedula', () => {
  it('usa la cédula como expediente (V-12345678)', () => {
    assert.equal(expedienteDesdeCedula('V-12.345.678'), 'V-12345678');
    assert.equal(expedienteDesdeCedula('v12345678'), 'V-12345678');
    assert.equal(expedienteDesdeCedula('12345678'), 'V-12345678');
  });

  it('respeta cédula de extranjero', () => {
    assert.equal(expedienteDesdeCedula('E-8123456'), 'E-8123456');
  });
});

describe('cedulaNormExpediente', () => {
  it('quita el guion para el índice de entidad', () => {
    assert.equal(cedulaNormExpediente('V-12345678'), 'V12345678');
  });
});
