import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  esContratoExpressAdministracionDelegada,
  esContratoExpressObrero,
  normalizarListaContratosExpressObrero,
} from '@/lib/talento/filtrarContratosExpressObrero';

describe('filtrarContratosExpressObrero', () => {
  it('excluye Administración Delegada por tipo, cédula AD o nombre', () => {
    assert.equal(
      esContratoExpressAdministracionDelegada({
        tipo_contrato: 'administracion_delegada',
        obrero_cedula: 'V1',
        obrero_nombre: 'X',
      }),
      true,
    );
    assert.equal(
      esContratoExpressAdministracionDelegada({
        tipo_contrato: 'obrero_express',
        obrero_cedula: 'AD',
        obrero_nombre: 'X',
      }),
      true,
    );
    assert.equal(
      esContratoExpressAdministracionDelegada({
        tipo_contrato: null,
        obrero_cedula: 'V123',
        obrero_nombre: 'Administración Delegada',
      }),
      true,
    );
    assert.equal(
      esContratoExpressObrero({
        tipo_contrato: 'obrero_express',
        obrero_cedula: 'V11142139',
        obrero_nombre: 'JESUS',
      }),
      true,
    );
  });

  it('deduplica por cédula y conserva el más reciente', () => {
    const out = normalizarListaContratosExpressObrero([
      {
        id: 'old-flam',
        created_at: '2026-08-04T18:57:00Z',
        obrero_cedula: 'V-10.296.250',
        obrero_nombre: 'FRANCISCO',
        tipo_contrato: 'obrero_express',
      },
      {
        id: 'new-juan',
        created_at: '2026-08-06T18:51:30Z',
        obrero_cedula: 'V10296250',
        obrero_nombre: 'FRANCISCO JOSE GONZALEZ FIGUEROA',
        tipo_contrato: 'obrero_express',
      },
      {
        id: 'ad',
        created_at: '2026-08-07T17:38:17Z',
        obrero_cedula: 'AD',
        obrero_nombre: 'Administración Delegada',
        tipo_contrato: 'administracion_delegada',
      },
      {
        id: 'otro',
        created_at: '2026-08-06T18:51:41Z',
        obrero_cedula: 'V11142139',
        obrero_nombre: 'JESUS',
        tipo_contrato: 'obrero_express',
      },
    ]);

    assert.equal(out.length, 2);
    assert.deepEqual(out.map((r) => r.id).sort(), ['new-juan', 'otro'].sort());
  });
});
