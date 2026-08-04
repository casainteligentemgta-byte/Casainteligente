/**
 * Ejecutar: npx tsx --test lib/talento/familiaOficioObrero.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { familiaOficioDesdeCargo } from './familiaOficioObrero';
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
});
