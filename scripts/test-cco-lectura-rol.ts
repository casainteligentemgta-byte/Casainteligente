import assert from 'node:assert/strict';
import {
  actorEsSoloVistaEmpresa,
  homeHrefParaRolesEmpresa,
  normalizarRolEmpresa,
  permisosDeRolesEmpresa,
} from '../lib/auth/permisosCatalogo';
import {
  hrefPermitidoPorModulos,
  modulosParaRolesEmpresa,
} from '../lib/auth/modulosPorRol';

assert.equal(normalizarRolEmpresa('visor_cco'), 'cco_lectura');
assert.equal(normalizarRolEmpresa('CCO solo lectura'), 'cco_lectura');
assert.equal(normalizarRolEmpresa('cco_solo_lectura'), 'cco_lectura');

const perms = permisosDeRolesEmpresa(['cco_lectura']);
assert.ok(perms.has('cco.ver'));
assert.equal(perms.has('cco.editar'), false);
assert.equal(perms.has('compra.registrar'), false);

assert.equal(actorEsSoloVistaEmpresa(['cco_lectura']), true);
assert.equal(actorEsSoloVistaEmpresa(['admin']), false);
assert.equal(homeHrefParaRolesEmpresa(['cco_lectura']), '/contabilidad/cco');
assert.equal(homeHrefParaRolesEmpresa(['contador']), '/');

const mods = modulosParaRolesEmpresa(['cco_lectura']);
assert.ok(mods.has('cco'));
assert.ok(mods.has('inicio'));
assert.equal(mods.has('contabilidad'), false);
assert.equal(mods.has('almacen'), false);

assert.equal(hrefPermitidoPorModulos('/contabilidad/cco', mods), true);
assert.equal(hrefPermitidoPorModulos('/contabilidad/compras', mods), false);
assert.equal(hrefPermitidoPorModulos('/almacen', mods), false);
assert.equal(hrefPermitidoPorModulos('/', mods), true);

const conta = modulosParaRolesEmpresa(['contador']);
assert.equal(hrefPermitidoPorModulos('/contabilidad/cco', conta), true);

console.log('ok: cco_lectura role gates');
