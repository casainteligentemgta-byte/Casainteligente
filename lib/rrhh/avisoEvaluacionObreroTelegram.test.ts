/**
 * Ejecutar: npx tsx --test lib/rrhh/avisoEvaluacionObreroTelegram.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { textoAvisoEvaluacionObrero } from './avisoEvaluacionObreroTelegram';

describe('textoAvisoEvaluacionObrero', () => {
  it('arma el aviso de evaluación para RRHH', () => {
    const texto = textoAvisoEvaluacionObrero({
      nombre: 'Mata Ortiz, Luis Vicente',
      cedula: 'V-13348186',
      oficio: '1,1 Ayudante',
      obra: 'Obra Sur',
      telefono: '04141234567',
      semaforo: 'verde',
      perfilColor: 'verde',
      baseUrl: 'https://casainteligente.company',
    });
    assert.match(texto, /Evaluación completada/);
    assert.match(texto, /Mata Ortiz, Luis Vicente/);
    assert.match(texto, /V-13348186/);
    assert.match(texto, /Obra Sur/);
    assert.match(texto, /🟢 Verde/);
    assert.match(texto, /rrhh\/evaluaciones/);
  });
});
