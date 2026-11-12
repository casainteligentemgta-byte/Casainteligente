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
    assert.equal(permisosDeRolesEmpresa(['entidad_admin']).has('clientes.borrar'), true);
    assert.equal(permisosDeRolesEmpresa(['director']).has('clientes.ver'), true);
  });
});

describe('permiso de pago de crédito', () => {
  it('está en el catálogo y solo admin, comprador y contador lo tienen', () => {
    assert.ok((PERMISOS as readonly string[]).includes('compra.credito_pagar'));
    assert.equal(permisosDeRolesEmpresa(['admin']).has('compra.credito_pagar'), true);
    assert.equal(permisosDeRolesEmpresa(['comprador']).has('compra.credito_pagar'), true);
    assert.equal(permisosDeRolesEmpresa(['contador']).has('compra.credito_pagar'), true);
    assert.equal(permisosDeRolesEmpresa(['pm_obra']).has('compra.credito_pagar'), false);
    assert.equal(permisosDeRolesEmpresa(['almacen_central']).has('compra.credito_pagar'), false);
  });
});

describe('permisos de productos / costos', () => {
  it('están en el catálogo', () => {
    for (const p of ['productos.ver', 'productos.costos'] as const) {
      assert.ok((PERMISOS as readonly string[]).includes(p), p);
    }
  });

  it('admin ve catálogo y costos; pm y comprador ven costos; rrhh no', () => {
    const admin = permisosDeRolesEmpresa(['admin']);
    const pm = permisosDeRolesEmpresa(['pm_obra']);
    const comprador = permisosDeRolesEmpresa(['comprador']);
    const rrhh = permisosDeRolesEmpresa(['rrhh']);
    assert.equal(admin.has('productos.ver'), true);
    assert.equal(admin.has('productos.costos'), true);
    assert.equal(pm.has('productos.costos'), true);
    assert.equal(comprador.has('productos.costos'), true);
    assert.equal(rrhh.has('productos.costos'), false);
    assert.equal(rrhh.has('productos.ver'), false);
  });
});
