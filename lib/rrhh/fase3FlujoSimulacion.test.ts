/**
 * Simulación del flujo fase 3 sin BD/UI (máquina → OK humano → contratado → nómina).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  etiquetaRecomendacionMaquina,
  pendienteDecisionHumana,
  ESTADO_TRAS_EXAMEN,
} from './decisionEvaluacionHumana';
import { derivarEtapaPipeline } from './rrhhPipeline';
import { rangoSemanaLaboral } from './incluirEmpleadoNominaSemanal';
import { etiquetaEstadoEmpleado } from './empleadoEstados';

describe('fase3 flujo simulado', () => {
  it('postulado → test → evaluado (pendiente OK) → aprobado → contratado → en_nomina', () => {
    // 1) HV cargada, sin test
    assert.equal(
      derivarEtapaPipeline({
        estado: ESTADO_TRAS_EXAMEN,
        estado_proceso: 'cv_completado',
      }),
      'postulado',
    );

    // 2) Test completado (máquina verde); aptitud aún pendiente
    const trasTest = {
      estado: ESTADO_TRAS_EXAMEN,
      semaforo: 'verde',
      status_evaluacion: 'aprobado',
      examen_completado_at: '2026-08-09T12:00:00Z',
      puntaje_total: 80,
    };
    assert.equal(pendienteDecisionHumana(trasTest), true);
    assert.equal(derivarEtapaPipeline(trasTest), 'evaluado');
    assert.equal(etiquetaEstadoEmpleado(trasTest), 'Pendiente OK RRHH');
    assert.match(
      etiquetaRecomendacionMaquina(trasTest).texto,
      /Recomendado aprobar/i,
    );

    // 3) OK humano
    const aprobado = {
      ...trasTest,
      estado: 'aprobado',
      estatus: 'disponible',
    };
    assert.equal(pendienteDecisionHumana(aprobado), false);
    assert.equal(derivarEtapaPipeline(aprobado), 'banca_disponible');

    // 4) Formalizado / asignado a obra
    const contratado = {
      ...aprobado,
      estatus: 'asignado',
      tiene_contrato: true,
    };
    assert.equal(derivarEtapaPipeline(contratado), 'contratado');

    // 5) Incluido en periodo semanal
    const enNomina = { ...contratado, en_nomina: true };
    assert.equal(derivarEtapaPipeline(enNomina), 'en_nomina');

    const semana = rangoSemanaLaboral(new Date(2026, 7, 9)); // domingo
    assert.equal(semana.fechaInicio, '2026-08-03');
    assert.equal(semana.fechaFin, '2026-08-09');
  });

  it('rojo máquina no rechaza hasta OK humano', () => {
    const rojo = {
      estado: ESTADO_TRAS_EXAMEN,
      semaforo: 'rojo',
      status_evaluacion: 'reprobado',
      examen_completado_at: '2026-08-09T12:00:00Z',
    };
    assert.equal(derivarEtapaPipeline(rojo), 'evaluado');
    assert.equal(pendienteDecisionHumana(rojo), true);
    assert.match(
      etiquetaRecomendacionMaquina(rojo).texto,
      /Recomendado rechazar/i,
    );

    assert.equal(
      derivarEtapaPipeline({ ...rojo, estado: 'rechazado' }),
      'rechazado',
    );
  });
});
