/**
 * Ejecutar: npx tsx --test lib/talento/bancoEvaluacionUnificadaObrero.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bancoEvaluacionUnificadaObrero,
  TOTAL_EVALUACION_UNIFICADA,
  TOTAL_EVALUACION_UNIFICADA_CHOFER,
} from './bancoEvaluacionUnificadaObrero';
import { evaluarSemaforoObrero } from './evaluarSemaforoObrero';
import { urlSiguientePostHv } from './flujoHvEvaluacion';

describe('bancoEvaluacionUnificadaObrero', () => {
  it('siempre 21 preguntas (con lógica)', () => {
    const b = bancoEvaluacionUnificadaObrero({ cargo: 'ELECTRICISTA DE 1ra.' });
    assert.equal(b.total, TOTAL_EVALUACION_UNIFICADA);
    assert.equal(b.total, 21);
    assert.equal(b.disc.length, 6);
    assert.equal(b.logica.length, 3);
    assert.equal(b.confiabilidad.length, 3);
    assert.equal(b.abc.length, 9);
    assert.equal(b.familia, 'electricidad');
    assert.equal(b.track, 'clasificado');
  });

  it('track ayudante con bloque distinto y mismas 21 preguntas', () => {
    const ayu = bancoEvaluacionUnificadaObrero({ cargo: 'AYUDANTE', codigoGoE: '2.1' });
    const elec = bancoEvaluacionUnificadaObrero({ cargo: 'ELECTRICISTA DE 1ra.', codigoGoE: '5.5' });
    assert.equal(ayu.total, 21);
    assert.equal(ayu.track, 'ayudante');
    assert.equal(ayu.familia, 'ayudante');
    assert.equal(ayu.abc.length, 9);
    assert.equal(ayu.etiquetaTrack, 'Ayudante');
    assert.equal(elec.etiquetaTrack, 'Personal clasificado');
    assert.notEqual(ayu.abc[6]?.pregunta, elec.abc[6]?.pregunta);
  });
});

describe('banco de chofer', () => {
  it('25 preguntas, sin las de obra del núcleo, con 13 situacionales de manejo', () => {
    const b = bancoEvaluacionUnificadaObrero({ cargo: 'CHOFER DE 1ra. (DE 8 A 15 TONS)', codigoGoE: '5.9' });
    assert.equal(b.familia, 'chofer');
    assert.equal(b.total, TOTAL_EVALUACION_UNIFICADA_CHOFER);
    assert.equal(b.total, 25);
    assert.equal(b.abc.length, 13);
    const ids = b.abc.map((q) => q.id);
    assert.ok(!ids.includes('obr_01'), 'sin la de arnés');
    assert.ok(ids.includes('obr_09') && ids.includes('obr_10'));
    assert.ok(ids.includes('chf_01') && ids.includes('chf_06'));
    assert.equal(new Set(ids).size, ids.length, 'claves ABC únicas');
  });

  it('todas las preguntas de chofer tienen opciones A, B y C', () => {
    const b = bancoEvaluacionUnificadaObrero({ cargo: 'Chofer personal / familiar' });
    for (const q of b.abc) {
      assert.deepEqual(
        q.opciones.map((o) => o.valor),
        ['A', 'B', 'C'],
        q.id,
      );
    }
  });

  it('dos respuestas de riesgo al volante dan rojo', () => {
    const b = bancoEvaluacionUnificadaObrero({ cargo: 'Chofer' });
    const todasA = Object.fromEntries(b.abc.map((q) => [q.id, 'A']));
    assert.equal(evaluarSemaforoObrero(todasA).semaforo, 'verde');
    assert.equal(evaluarSemaforoObrero({ ...todasA, obr_18: 'C' }).semaforo, 'amarillo');
    assert.equal(evaluarSemaforoObrero({ ...todasA, obr_18: 'C', chf_03: 'C' }).semaforo, 'rojo');
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
