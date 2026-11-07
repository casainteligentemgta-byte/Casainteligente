import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  esDiaHabilBancarioVE,
  esFeriadoBancarioVE,
  esFinDeSemanaIso,
  hayDiaHabilBancarioPosteriorA,
} from './feriadosBancariosVE';

describe('calendario bancario VE', () => {
  it('Carnaval y Semana Santa 2026-2027 son feriados', () => {
    assert.equal(esFeriadoBancarioVE('2026-02-16'), true);
    assert.equal(esFeriadoBancarioVE('2026-02-17'), true);
    assert.equal(esFeriadoBancarioVE('2026-04-02'), true);
    assert.equal(esFeriadoBancarioVE('2026-04-03'), true);
    assert.equal(esFeriadoBancarioVE('2027-02-08'), true);
    assert.equal(esFeriadoBancarioVE('2027-02-09'), true);
    assert.equal(esFeriadoBancarioVE('2027-03-25'), true);
    assert.equal(esFeriadoBancarioVE('2027-03-26'), true);
  });

  it('un viernes laborable no es feriado ni fin de semana', () => {
    assert.equal(esFeriadoBancarioVE('2026-11-06'), false);
    assert.equal(esFinDeSemanaIso('2026-11-06'), false);
    assert.equal(esDiaHabilBancarioVE('2026-11-06'), true);
  });

  it('sábado y domingo no son hábiles', () => {
    assert.equal(esFinDeSemanaIso('2026-11-07'), true);
    assert.equal(esFinDeSemanaIso('2026-11-08'), true);
    assert.equal(esDiaHabilBancarioVE('2026-11-07'), false);
    assert.equal(esDiaHabilBancarioVE('2026-11-08'), false);
    assert.equal(esDiaHabilBancarioVE('2026-11-09'), true);
  });

  it('no hay día hábil entre viernes y domingo; sí al lunes', () => {
    assert.equal(hayDiaHabilBancarioPosteriorA('2026-11-06', '2026-11-07'), false);
    assert.equal(hayDiaHabilBancarioPosteriorA('2026-11-06', '2026-11-08'), false);
    assert.equal(hayDiaHabilBancarioPosteriorA('2026-11-06', '2026-11-09'), true);
  });

  it('Carnaval 2026: viernes 13 sigue vigente hasta el martes 17', () => {
    assert.equal(hayDiaHabilBancarioPosteriorA('2026-02-13', '2026-02-16'), false);
    assert.equal(hayDiaHabilBancarioPosteriorA('2026-02-13', '2026-02-17'), false);
    assert.equal(hayDiaHabilBancarioPosteriorA('2026-02-13', '2026-02-18'), true);
  });
});
