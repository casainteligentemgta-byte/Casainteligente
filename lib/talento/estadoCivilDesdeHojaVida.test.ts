import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estadoCivilContratoObrero } from '@/lib/talento/cedulaAuth';
import {
  estadoCivilDesdeHojaVidaJson,
  resolverEstadoCivilContrato,
} from '@/lib/talento/estadoCivilDesdeHojaVida';

describe('estado civil contrato — hoja de vida primero', () => {
  it('vacío → Soltero', () => {
    assert.equal(estadoCivilContratoObrero(null), 'Soltero');
    assert.equal(estadoCivilContratoObrero('', '  '), 'Soltero');
  });

  it('varios candidatos: gana el primero no vacío (hoja)', () => {
    assert.equal(estadoCivilContratoObrero('Casado', 'Soltero'), 'Casado');
    assert.equal(estadoCivilContratoObrero(null, '', 'Viudo'), 'Viudo');
  });

  it('extrae de JSON de hoja de vida', () => {
    assert.equal(
      estadoCivilDesdeHojaVidaJson({ datosPersonales: { estadoCivil: ' Casada ' } }),
      'Casada',
    );
    assert.equal(estadoCivilDesdeHojaVidaJson({ datosPersonales: { estadoCivil: '' } }), null);
    assert.equal(estadoCivilDesdeHojaVidaJson(null), null);
  });

  it('resolver: hoja > columna > manual > Soltero', () => {
    assert.equal(
      resolverEstadoCivilContrato({
        desdeHoja: 'Casado',
        desdeColumna: 'Soltero',
        manual: 'Soltero',
      }),
      'Casado',
    );
    assert.equal(
      resolverEstadoCivilContrato({
        desdeHoja: null,
        desdeColumna: 'Divorciado',
        manual: 'Soltero',
      }),
      'Divorciado',
    );
    assert.equal(
      resolverEstadoCivilContrato({
        desdeHoja: null,
        desdeColumna: null,
        manual: null,
      }),
      'Soltero',
    );
  });
});
