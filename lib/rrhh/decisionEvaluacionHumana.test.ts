import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  etiquetaRecomendacionMaquina,
  pendienteDecisionHumana,
  ESTADO_TRAS_EXAMEN,
} from './decisionEvaluacionHumana';
import { rangoSemanaLaboral } from './incluirEmpleadoNominaSemanal';

describe('decisionEvaluacionHumana', () => {
  it('pendiente solo con evaluacion_pendiente + resultado máquina', () => {
    assert.equal(
      pendienteDecisionHumana({
        estado: ESTADO_TRAS_EXAMEN,
        examen_completado_at: '2026-08-01T12:00:00Z',
        semaforo: 'verde',
      }),
      true,
    );
    assert.equal(
      pendienteDecisionHumana({
        estado: 'aprobado',
        examen_completado_at: '2026-08-01T12:00:00Z',
        semaforo: 'verde',
      }),
      false,
    );
    assert.equal(
      pendienteDecisionHumana({
        estado: ESTADO_TRAS_EXAMEN,
        examen_completado_at: null,
        semaforo: null,
        status_evaluacion: null,
      }),
      false,
    );
  });

  it('etiqueta recomendación según semáforo', () => {
    const verde = etiquetaRecomendacionMaquina({
      semaforo: 'verde',
      status_evaluacion: 'aprobado',
      motivo_semaforo: 'Perfil seguro',
    });
    assert.match(verde.texto, /Recomendado aprobar/i);

    const rojo = etiquetaRecomendacionMaquina({
      semaforo: 'rojo',
      status_evaluacion: 'reprobado',
    });
    assert.match(rojo.texto, /Recomendado rechazar/i);
  });
});

describe('rangoSemanaLaboral', () => {
  it('lunes a domingo ISO', () => {
    // Miércoles 2026-08-05 → lun 03 → dom 09
    const r = rangoSemanaLaboral(new Date(2026, 7, 5));
    assert.equal(r.fechaInicio, '2026-08-03');
    assert.equal(r.fechaFin, '2026-08-09');
    assert.ok(r.numeroSemana >= 1);
  });
});
