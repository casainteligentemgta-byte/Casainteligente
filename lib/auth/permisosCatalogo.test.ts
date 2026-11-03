import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PERMISOS, permisosDeRolesEmpresa } from './permisosCatalogo';

describe('permisos de clientes', () => {
  it('están en el catálogo', () => {
    for (const p of ['clientes.ver', 'clientes.editar', 'clientes.borrar'] as const) {
      assert.ok((PERMISOS as readonly string[]).includes(p), p);
    }
  });

  it('admin y pm_obra pueden ver y editar clientes; el comprador no', () => {
    const admin = permisosDeRolesEmpresa(['admin']);
    const pm = permisosDeRolesEmpresa(['pm_obra']);
    const comprador = permisosDeRolesEmpresa(['comprador']);
    assert.equal(admin.has('clientes.ver'), true);
    assert.equal(pm.has('clientes.editar'), true);
    assert.equal(comprador.has('clientes.ver'), false);
  });
});
