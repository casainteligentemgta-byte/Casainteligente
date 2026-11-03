import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ubicacionPerteneceAlProyectoDb } from './validarUbicacionProyecto';

const OBRA = '11111111-1111-4111-8111-111111111111';
const OTRA = '22222222-2222-4222-8222-222222222222';
const ENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ENT2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('ubicación vs obra', () => {
  it('acepta almacén con ci_proyecto_id de la obra', () => {
    assert.equal(
      ubicacionPerteneceAlProyectoDb(
        { id: 'u1', activo: true, ci_proyecto_id: OBRA, entidad_id: ENT },
        OBRA,
        ENT,
      ),
      true,
    );
  });

  it('rechaza almacén de otra obra aunque la entidad coincida', () => {
    assert.equal(
      ubicacionPerteneceAlProyectoDb(
        { id: 'u1', activo: true, ci_proyecto_id: OTRA, entidad_id: ENT },
        OBRA,
        ENT,
      ),
      false,
    );
  });

  it('acepta depósito central de la misma entidad sin obra', () => {
    assert.equal(
      ubicacionPerteneceAlProyectoDb(
        { id: 'u1', activo: true, ci_proyecto_id: null, entidad_id: ENT },
        OBRA,
        ENT,
      ),
      true,
    );
  });

  it('rechaza depósito de otra entidad o inactivo', () => {
    assert.equal(
      ubicacionPerteneceAlProyectoDb(
        { id: 'u1', activo: true, ci_proyecto_id: null, entidad_id: ENT2 },
        OBRA,
        ENT,
      ),
      false,
    );
    assert.equal(
      ubicacionPerteneceAlProyectoDb(
        { id: 'u1', activo: false, ci_proyecto_id: OBRA, entidad_id: ENT },
        OBRA,
        ENT,
      ),
      false,
    );
  });
});
