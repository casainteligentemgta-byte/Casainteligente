import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  derivarEtapaPipeline,
  mensajeWhatsAppOfertaPlaza,
  puedeOfertarDesdeBanca,
  RRHH_PIPELINE_PASOS,
} from './rrhhPipeline';

describe('rrhhPipeline', () => {
  it('deriva banca_disponible si aprobado y disponible', () => {
    assert.equal(
      derivarEtapaPipeline({ estado: 'aprobado', estatus: 'disponible' }),
      'banca_disponible',
    );
  });

  it('deriva contratado si tiene_contrato o asignado', () => {
    assert.equal(
      derivarEtapaPipeline({ estado: 'aprobado', estatus: 'asignado' }),
      'contratado',
    );
    assert.equal(
      derivarEtapaPipeline({
        estado: 'aprobado',
        estatus: 'disponible',
        tiene_contrato: true,
      }),
      'contratado',
    );
  });

  it('deriva postulado con cv_completado', () => {
    assert.equal(
      derivarEtapaPipeline({
        estado: 'evaluacion_pendiente',
        estado_proceso: 'cv_completado',
      }),
      'postulado',
    );
  });

  it('puede ofertar desde banca solo obrero aprobado disponible', () => {
    assert.equal(
      puedeOfertarDesdeBanca({
        rol_examen: 'obrero',
        estado: 'aprobado',
        estatus: 'disponible',
      }),
      true,
    );
    assert.equal(
      puedeOfertarDesdeBanca({
        rol_examen: 'programador',
        estado: 'aprobado',
        estatus: 'disponible',
      }),
      false,
    );
  });

  it('mensaje oferta pide SÍ/NO', () => {
    const m = mensajeWhatsAppOfertaPlaza({
      nombreObrero: 'José',
      oficio: 'Albañil de 1ra.',
      obraNombre: 'Asfaltado',
    });
    assert.match(m, /José/);
    assert.match(m, /Albañil/);
    assert.match(m, /Asfaltado/);
    assert.match(m, /SÍ/);
    assert.match(m, /NO/);
  });

  it('pipeline incluye evaluación, carnet y egreso', () => {
    const ids = RRHH_PIPELINE_PASOS.map((p) => p.id);
    assert.ok(ids.includes('evaluacion'));
    assert.ok(ids.includes('carnet'));
    assert.ok(ids.includes('egreso'));
    assert.ok(ids.includes('banca'));
  });
});

