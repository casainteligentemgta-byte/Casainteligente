import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { entidadActivaDesdeRoles, esAdminGlobalRoles } from './entidadActiva';
import { mensajeConfirmarArchivar, payloadClientePermitido } from './guardarCliente';
import { numeroWhatsapp } from './numeroWhatsapp';

const E1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const E2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('entidad activa', () => {
  it('toma la primera entidad con UUID de los roles', () => {
    assert.equal(
      entidadActivaDesdeRoles([
        { rol: 'pm_obra', entidad_id: E1 },
        { rol: 'pm_obra', entidad_id: E2 },
      ]),
      E1,
    );
    assert.equal(entidadActivaDesdeRoles([{ rol: 'pm_obra', entidad_id: '' }]), null);
  });

  it('reconoce admin global por super_admin o admin', () => {
    assert.equal(esAdminGlobalRoles(['super_admin']), true);
    assert.equal(esAdminGlobalRoles(['admin']), true);
    assert.equal(esAdminGlobalRoles(['pm_obra']), false);
  });
});

describe('payload y archivo', () => {
  it('no deja colar entidad_id ni id desde el cliente', () => {
    const p = payloadClientePermitido({
      nombre: 'Luis',
      entidad_id: E1,
      id: 'no',
      status: 'activo',
    });
    assert.equal(p.nombre, 'Luis');
    assert.equal(p.entidad_id, undefined);
    assert.equal(p.id, undefined);
    assert.equal(p.status, 'activo');
  });

  it('pide confirmación clara antes de archivar', () => {
    assert.match(mensajeConfirmarArchivar('Casa López'), /Archivar a Casa López/);
    assert.match(mensajeConfirmarArchivar(''), /este cliente/);
  });
});

describe('numeroWhatsapp único', () => {
  it('deja el celular venezolano en 58XXXXXXXXXX', () => {
    assert.equal(numeroWhatsapp('0414-123 45 67'), '584141234567');
    assert.equal(numeroWhatsapp('4141234567'), '584141234567');
    assert.equal(numeroWhatsapp('+58 414 1234567'), '584141234567');
    assert.equal(numeroWhatsapp('5804141234567'), '584141234567');
  });
});
