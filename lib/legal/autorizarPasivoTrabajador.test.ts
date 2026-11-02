import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  puedeCalcularPasivoConRoles,
  rolPasivoEsDeEntidad,
  rolPasivoEsGlobal,
} from './autorizarPasivoTrabajador';

const ENT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ENT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('autorizarPasivoTrabajador', () => {
  it('super_admin (y alias admin) ve cualquier entidad, incluso sin entidad_id', () => {
    assert.equal(rolPasivoEsGlobal('super_admin'), true);
    assert.equal(rolPasivoEsGlobal('Admin'), true);
    assert.equal(
      puedeCalcularPasivoConRoles([{ rol: 'super_admin', entidad_id: ENT_A }], ENT_B),
      true,
    );
    assert.equal(
      puedeCalcularPasivoConRoles([{ rol: 'administrador', entidad_id: ENT_A }], null),
      true,
    );
  });

  it('entidad_admin, director y rrhh solo ven su entidad', () => {
    for (const rol of ['entidad_admin', 'director', 'rrhh']) {
      assert.equal(rolPasivoEsDeEntidad(rol), true);
      assert.equal(
        puedeCalcularPasivoConRoles([{ rol, entidad_id: ENT_A }], ENT_A),
        true,
      );
      assert.equal(
        puedeCalcularPasivoConRoles([{ rol, entidad_id: ENT_A }], ENT_B),
        false,
      );
      assert.equal(
        puedeCalcularPasivoConRoles([{ rol, entidad_id: ENT_A }], null),
        false,
      );
    }
  });

  it('pm_obra y comprador no calculan pasivo aunque coincida la entidad', () => {
    assert.equal(
      puedeCalcularPasivoConRoles([{ rol: 'pm_obra', entidad_id: ENT_A }], ENT_A),
      false,
    );
    assert.equal(
      puedeCalcularPasivoConRoles([{ rol: 'comprador', entidad_id: ENT_A }], ENT_A),
      false,
    );
  });
});
