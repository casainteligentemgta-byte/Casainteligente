import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  codigoCortoDesdeNombre,
  formatearExpedienteContrato,
} from '@/lib/talento/nomenclaturaExpedienteContrato';

describe('nomenclaturaExpedienteContrato', () => {
  it('códigos cortos de entidad y obra', () => {
    assert.equal(codigoCortoDesdeNombre('DIMAQUINAS, C.A.'), 'DIMA');
    assert.equal(codigoCortoDesdeNombre('Casa Inteligente'), 'CASA');
    assert.equal(codigoCortoDesdeNombre('Asfaltado'), 'ASFALT');
  });

  it('formatea AÑO-MES-ENTIDAD-OBRA-Número', () => {
    assert.equal(
      formatearExpedienteContrato({
        anio: 2026,
        mes: 8,
        entidadCodigo: 'DIMA',
        obraCodigo: 'ASFALT',
        numero: 1,
      }),
      '2026-08-DIMA-ASFALT-0001',
    );
    assert.equal(
      formatearExpedienteContrato({
        anio: 2026,
        mes: 12,
        entidadCodigo: 'CASA',
        obraCodigo: 'OBRA1',
        numero: 42,
      }),
      '2026-12-CASA-OBRA1-0042',
    );
  });
});
