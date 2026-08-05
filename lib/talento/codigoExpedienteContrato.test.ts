import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  construirCodigoExpedienteContrato,
  nomenclaturaEntidadContrato,
  nomenclaturaObraContrato,
  slugParteCodigoContrato,
} from '@/lib/talento/codigoExpedienteContrato';

describe('codigoExpedienteContrato', () => {
  it('slug limpia acentos y símbolos', () => {
    assert.equal(slugParteCodigoContrato('Rancho Flamboyant'), 'RANCHOFLAMBOYANT');
    assert.equal(slugParteCodigoContrato('C.A. Casa'), 'CACASA');
  });

  it('nomenclatura entidad prioriza abreviado', () => {
    assert.equal(nomenclaturaEntidadContrato('CI', 'Casa Inteligente C.A.'), 'CI');
    assert.equal(nomenclaturaEntidadContrato(null, 'Casa Inteligente'), 'CI');
  });

  it('nomenclatura obra prioriza codigo', () => {
    assert.equal(nomenclaturaObraContrato('RF-01', 'Rancho Flamboyant'), 'RF01');
    assert.equal(nomenclaturaObraContrato(null, 'Asfaltado Norte'), 'ASFALTADONORTE');
  });

  it('arma YYYY-MM-ENT-OBRA-NN', () => {
    const code = construirCodigoExpedienteContrato({
      fecha: '2026-08-05T12:00:00.000Z',
      entidadAbreviado: 'CI',
      obraCodigo: 'FLAM',
      correlativo: 3,
    });
    assert.equal(code, '2026-08-CI-FLAM-03');
  });
});
