/**
 * Ejecutar: npx tsx --test lib/rrhh/informeEvaluacionUnificada.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { armarInformeEvaluacionUnificada, parseRespuestasAbc } from './informeEvaluacionUnificada';

describe('parseRespuestasAbc', () => {
  it('conserva A/B/C y descarta números', () => {
    const m = parseRespuestasAbc({ obr_01: 'A', obr_02: 'b', d01: 2 });
    assert.equal(m.obr_01, 'A');
    assert.equal(m.obr_02, 'B');
    assert.equal(m.d01, undefined);
  });
});

describe('armarInformeEvaluacionUnificada', () => {
  it('arma resultado y respuestas del test unificado', () => {
    const inf = armarInformeEvaluacionUnificada({
      cargo: 'AYUDANTE',
      codigoGoE: '2.1',
      perfilColor: 'Verde',
      evaluacionRaw: {
        unificada: true,
        disc: { d01: 'Verde' },
        logica: { l02: 0 },
        confiabilidad: { c01: 0 },
        abc: { obr_01: 'A', obr_02: 'A', obr_03: 'C' },
      },
    });
    assert.equal(inf.resultado.perfilColor, 'Verde');
    assert.ok(inf.items.some((i) => i.seccion === 'Cómo eres en la obra' && i.detalle === 'Verde'));
    assert.ok(inf.items.some((i) => i.id === 'obr_01' && i.respondio.startsWith('A)')));
    assert.ok(inf.resultado.abcC >= 1);
    assert.ok(inf.resultado.semaforo);
  });
});
