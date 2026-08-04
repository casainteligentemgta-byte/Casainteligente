/**
 * Ejecutar: npx tsx --test lib/talento/bancoEvaluacionUnificadaObrero.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bancoEvaluacionUnificadaObrero,
  TOTAL_MINIMO_SIN_LOGICA,
  TOTAL_RECOMENDADO,
} from './bancoEvaluacionUnificadaObrero';
import { evaluarSemaforoObrero } from './evaluarSemaforoObrero';
import { urlSiguientePostHv } from './flujoHvEvaluacion';

describe('bancoEvaluacionUnificadaObrero', () => {
  it('recomendado = 21 (con lógica)', () => {
    const b = bancoEvaluacionUnificadaObrero({ cargo: 'ELECTRICISTA DE 1ra.', incluirLogica: true });
    assert.equal(b.total, TOTAL_RECOMENDADO);
    assert.equal(b.total, 21);
    assert.equal(b.disc.length, 6);
    assert.equal(b.logica.length, 3);
    assert.equal(b.confiabilidad.length, 3);
    assert.equal(b.abc.length, 9);
    assert.equal(b.familia, 'electricidad');
  });

  it('mínimo = 18 (sin lógica)', () => {
    const b = bancoEvaluacionUnificadaObrero({ cargo: 'Ayudante', incluirLogica: false });
    assert.equal(b.total, TOTAL_MINIMO_SIN_LOGICA);
    assert.equal(b.total, 18);
    assert.equal(b.logica.length, 0);
  });
});

describe('evaluarSemaforoObrero con banco reducido', () => {
  it('escala umbrales a 9 ítems', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const allA = Object.fromEntries(ids.map((id) => [id, 'A']));
    assert.equal(evaluarSemaforoObrero(allA).semaforo, 'verde');
    const twoC = { ...allA, a: 'C', b: 'C' };
    assert.equal(evaluarSemaforoObrero(twoC).semaforo, 'rojo');
  });
});

describe('flujoHvEvaluacion', () => {
  it('post-HV apunta a evaluación unificada', () => {
    const u = urlSiguientePostHv('tok123', 'https://casainteligente.company');
    assert.equal(u, 'https://casainteligente.company/talento/evaluacion?token=tok123');
  });
});
