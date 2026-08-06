import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  codigoCortoDesdeNombre,
  codigosDesdeNombresExpediente,
  esExpedientePlaceholder,
  formatearExpedienteContrato,
  parsearExpedienteContrato,
} from '@/lib/talento/nomenclaturaExpedienteContrato';

describe('nomenclaturaExpedienteContrato', () => {
  it('códigos cortos de entidad y obra', () => {
    assert.equal(codigoCortoDesdeNombre('DIMAQUINAS, C.A.'), 'DIMA');
    assert.equal(codigoCortoDesdeNombre('Casa Inteligente'), 'CASA');
    assert.equal(codigoCortoDesdeNombre('Asfaltado'), 'ASFALT');
    assert.equal(codigoCortoDesdeNombre(''), 'XXX');
  });

  it('codigosDesdeNombresExpediente deriva entidad y usa obra_codigo', () => {
    const a = codigosDesdeNombresExpediente({
      entidadNombre: 'DIMAQUINAS, C.A.',
      obraCodigoFuente: 'ASFALT',
    });
    assert.equal(a.entidadCodigo, 'DIMA');
    assert.equal(a.obraCodigo, 'ASFALT');

    const b = codigosDesdeNombresExpediente({
      entidadNombre: 'Casa Inteligente MGTA',
      obraCodigoFuente: 'Ampliación Avenida 28',
    });
    assert.equal(b.entidadCodigo, 'CASA');
    assert.equal(b.obraCodigo, 'AMPLIACI');

    const vacio = codigosDesdeNombresExpediente({
      entidadNombre: '',
      obraCodigoFuente: '',
    });
    assert.equal(vacio.entidadCodigo, 'XXX');
    assert.equal(vacio.obraCodigo, 'XXX');
  });

  it('detecta placeholders ENTE-OBRA', () => {
    assert.equal(esExpedientePlaceholder('2026-08-ENTE-OBRA-0018'), true);
    assert.equal(esExpedientePlaceholder('2026-08-DIMA-ASFALT-0001'), false);
    assert.equal(esExpedientePlaceholder('EXPRESS-foo'), true);
  });

  it('parsea y formatea AÑO-MES-ENTIDAD-OBRA-Número', () => {
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
    const p = parsearExpedienteContrato('2026-08-ENTE-OBRA-0018');
    assert.ok(p);
    assert.equal(p!.entidadCodigo, 'ENTE');
    assert.equal(p!.obraCodigo, 'OBRA');
    assert.equal(p!.numero, 18);
  });
});
