/**
 * Ejecutar: npx tsx --test lib/talento/familiaOficioObrero.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { familiaOficioDesdeCargo, trackEvaluacionObrero } from './familiaOficioObrero';
import { armarPreguntasAbcObrero } from './preguntasAbcFamiliaObrero';
import { PREGUNTAS_OBRERO_NUCLEO } from './exam';

describe('familiaOficioDesdeCargo', () => {
  it('detecta electricidad', () => {
    assert.equal(familiaOficioDesdeCargo({ cargo: 'ELECTRICISTA DE 1ra.' }), 'electricidad');
  });
  it('detecta plomería', () => {
    assert.equal(familiaOficioDesdeCargo({ cargo: 'Plomero de 2da.' }), 'plomeria');
  });
  it('detecta vigilancia por rol_examen', () => {
    assert.equal(familiaOficioDesdeCargo({ cargo: 'Ayudante', rolExamen: 'vigilante' }), 'vigilancia');
  });
  it('detecta equipos', () => {
    assert.equal(familiaOficioDesdeCargo({ cargo: 'CHOFER DE 1ra. (DE 8 A 15 TONS)' }), 'equipos');
  });
  it('detecta estructuras', () => {
    assert.equal(familiaOficioDesdeCargo({ cargo: 'CABILLERO DE 1ra.' }), 'estructuras');
  });
  it('separa ayudante de obra civil', () => {
    assert.equal(familiaOficioDesdeCargo({ cargo: 'AYUDANTE', codigoGoE: '2.1' }), 'ayudante');
    assert.equal(familiaOficioDesdeCargo({ cargo: 'OBRERO DE 1era.', codigoGoE: '1.1' }), 'ayudante');
    assert.equal(familiaOficioDesdeCargo({ cargo: 'Ayudante de operadores' }), 'ayudante');
    assert.equal(familiaOficioDesdeCargo({ codigoGoE: '2,2' }), 'ayudante');
    assert.equal(familiaOficioDesdeCargo({ codigoGoE: '2.8' }), 'ayudante');
  });
  it('chofer y vigilante no caen en ayudante', () => {
    assert.equal(familiaOficioDesdeCargo({ cargo: 'CHOFER DE 4ta.', codigoGoE: '2.3' }), 'equipos');
    assert.equal(familiaOficioDesdeCargo({ cargo: 'VIGILANTE', codigoGoE: '1.2' }), 'vigilancia');
  });
  it('infiere familia solo con código GOE del tabulador', () => {
    assert.equal(familiaOficioDesdeCargo({ codigoGoE: '5.5' }), 'electricidad');
    assert.equal(familiaOficioDesdeCargo({ codigoGoE: '2.3' }), 'equipos');
  });
});

describe('armarPreguntasAbcObrero', () => {
  it('devuelve 20 preguntas y bloque distinto por familia', () => {
    const gen = armarPreguntasAbcObrero({ nucleo: PREGUNTAS_OBRERO_NUCLEO });
    const elec = armarPreguntasAbcObrero({
      nucleo: PREGUNTAS_OBRERO_NUCLEO,
      cargo: 'ELECTRICISTA DE 1ra.',
    });
    assert.equal(gen.preguntas.length, 20);
    assert.equal(elec.preguntas.length, 20);
    assert.equal(elec.familia, 'electricidad');
    assert.notEqual(gen.preguntas[15]?.pregunta, elec.preguntas[15]?.pregunta);
    assert.equal(elec.preguntas[15]?.id, 'obr_16');
  });

  it('bloque de ayudante no es el de oficio clasificado', () => {
    const ayu = armarPreguntasAbcObrero({
      nucleo: PREGUNTAS_OBRERO_NUCLEO,
      cargo: 'AYUDANTE',
      codigoGoE: '2.1',
    });
    const elec = armarPreguntasAbcObrero({
      nucleo: PREGUNTAS_OBRERO_NUCLEO,
      cargo: 'ELECTRICISTA DE 1ra.',
      codigoGoE: '5.5',
    });
    assert.equal(ayu.familia, 'ayudante');
    assert.notEqual(ayu.preguntas[15]?.pregunta, elec.preguntas[15]?.pregunta);
    assert.match(ayu.preguntas[15]?.pregunta ?? '', /encargado|compañero|entendiste|cargar|hueco/i);
  });
});

describe('trackEvaluacionObrero', () => {
  it('marca ayudante y clasificado', () => {
    assert.equal(trackEvaluacionObrero({ cargo: 'AYUDANTE', codigoGoE: '2.1' }), 'ayudante');
    assert.equal(trackEvaluacionObrero({ cargo: 'ELECTRICISTA DE 1ra.', codigoGoE: '5.5' }), 'clasificado');
    assert.equal(trackEvaluacionObrero({ cargo: 'Ayudante', rolExamen: 'vigilante' }), 'clasificado');
    assert.equal(trackEvaluacionObrero({ codigoGoE: '2.3' }), 'clasificado');
    assert.equal(trackEvaluacionObrero({ codigoGoE: '1.2' }), 'clasificado');
    assert.equal(trackEvaluacionObrero({ codigoGoE: '2.10' }), 'ayudante');
  });
});
