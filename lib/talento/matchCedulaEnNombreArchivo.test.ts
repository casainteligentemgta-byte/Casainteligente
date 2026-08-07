import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cedulaDigitosDesdeNombreArchivo,
  contratoCoincideConNombreArchivo,
} from '@/lib/talento/matchCedulaEnNombreArchivo';

describe('cedulaDigitosDesdeNombreArchivo', () => {
  it('detecta V-12345678.pdf', () => {
    assert.equal(cedulaDigitosDesdeNombreArchivo('V-12345678.pdf'), '12345678');
  });

  it('detecta contrato_V12345678_firmado.jpg', () => {
    assert.equal(cedulaDigitosDesdeNombreArchivo('contrato_V12345678_firmado.jpg'), '12345678');
  });

  it('detecta dígitos con puntos', () => {
    assert.equal(cedulaDigitosDesdeNombreArchivo('12.345.678.pdf'), '12345678');
  });

  it('empareja con cédula de fila', () => {
    assert.equal(contratoCoincideConNombreArchivo('V-12345678', 'V12345678.pdf'), true);
    assert.equal(contratoCoincideConNombreArchivo('V-99999999', 'V12345678.pdf'), false);
  });
});
