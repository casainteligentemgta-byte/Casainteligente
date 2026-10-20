/**
 * Ejecutar: npx tsx --test lib/reclutamiento/examenPrimero.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  apruebaParaHojaVida,
  bloqueoHojaVidaExamenPrimero,
  cedulaComparable,
  nombreCompletoBasico,
  urlEvaluacionExamenPrimero,
  urlHojaVidaExamenPrimero,
} from './examenPrimero';

describe('examen primero', () => {
  it('verde y amarillo pasan a la hoja de vida; rojo no', () => {
    assert.equal(apruebaParaHojaVida('verde'), true);
    assert.equal(apruebaParaHojaVida('amarillo'), true);
    assert.equal(apruebaParaHojaVida('rojo'), false);
    assert.equal(apruebaParaHojaVida(null), false);
  });

  it('la hoja de vida se bloquea antes del examen y si sale en rojo', () => {
    assert.match(
      bloqueoHojaVidaExamenPrimero({ examenPrimero: true, estatusEvaluacion: null }) ?? '',
      /Primero completa la evaluación/,
    );
    assert.match(
      bloqueoHojaVidaExamenPrimero({ examenPrimero: true, estatusEvaluacion: 'completado', semaforo: 'rojo' }) ?? '',
      /Reclutamiento revisará/,
    );
    assert.equal(
      bloqueoHojaVidaExamenPrimero({ examenPrimero: true, estatusEvaluacion: 'completado', semaforo: 'amarillo' }),
      null,
    );
  });

  it('las vacantes clásicas nunca se bloquean', () => {
    assert.equal(bloqueoHojaVidaExamenPrimero({ examenPrimero: false, estatusEvaluacion: null }), null);
    assert.equal(
      bloqueoHojaVidaExamenPrimero({ examenPrimero: false, estatusEvaluacion: 'completado', semaforo: 'rojo' }),
      null,
    );
  });

  it('URLs del flujo usan el mismo token', () => {
    assert.equal(
      urlEvaluacionExamenPrimero('tok', 'https://casainteligente.company/'),
      'https://casainteligente.company/talento/evaluacion?token=tok',
    );
    assert.equal(
      urlHojaVidaExamenPrimero('tok', 'https://casainteligente.company'),
      'https://casainteligente.company/reclutamiento/onboarding/tok',
    );
  });

  it('nombre y cédula se normalizan', () => {
    assert.equal(nombreCompletoBasico({ primerNombre: ' Juan ', primerApellido: 'Pérez' }), 'Pérez, Juan');
    assert.equal(cedulaComparable('V-12.345.678'), '12345678');
  });
});
