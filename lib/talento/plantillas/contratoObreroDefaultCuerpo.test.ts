import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONTRATO_OBRERO_CUERPO_DEFAULT,
  esCuerpoContratoObreroObsoleto,
} from './contratoObreroDefaultCuerpo';

describe('contrato obrero: nueve cláusulas vigentes', () => {
  it('cierra en PRIMERA–NOVENA, sin ética ni DÉCIMA', () => {
    const c = CONTRATO_OBRERO_CUERPO_DEFAULT;
    assert.match(c, /PRIMERA: OBJETO Y MODALIDAD/);
    assert.match(c, /SEGUNDA: PERÍODO DE PRUEBA/);
    assert.match(c, /TERCERA: DURACIÓN Y TERMINACIÓN/);
    assert.match(c, /CUARTA: JORNADA, HORARIO Y RENDIMIENTO/);
    assert.match(c, /QUINTA: LUGAR DE TRABAJO Y DIRECCIÓN/);
    assert.match(c, /SEXTA: SALARIO Y BENEFICIOS SOCIALES/);
    assert.match(c, /SÉPTIMA: SEMANA ADICIONAL POR MES/);
    assert.match(c, /OCTAVA: TRANSPORTE GRATUITO/);
    assert.match(c, /NOVENA: DOMICILIO PROCESAL/);
    assert.doesNotMatch(c, /ÉTICA Y CONFIDENCIALIDAD/);
    assert.doesNotMatch(c, /DÉCIMA:/);
    assert.equal(esCuerpoContratoObreroObsoleto(c), false);
  });

  it('marca obsoleto el cuerpo con ética OCTAVA y domicilio DÉCIMA', () => {
    const viejo = `${CONTRATO_OBRERO_CUERPO_DEFAULT}\nOCTAVA: ÉTICA Y CONFIDENCIALIDAD. Reserva.\nDÉCIMA: DOMICILIO PROCESAL.`;
    assert.equal(esCuerpoContratoObreroObsoleto(viejo), true);
  });
});
