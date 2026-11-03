import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { actorTienePermiso, type ActorPermisos } from './permisos';

function actor(partial: Partial<ActorPermisos>): ActorPermisos {
  return {
    tipo: 'web',
    rolesEmpresa: [],
    rolesObra: [],
    permisos: new Set(),
    ...partial,
  };
}

describe('actorTienePermiso con proyectoId', () => {
  const depoA: ActorPermisos = actor({
    rolesObra: [{ proyectoId: 'obra-a', rol: 'depositario' }],
  });

  it('concede almacen.ingreso solo en su obra', () => {
    assert.equal(actorTienePermiso(depoA, 'almacen.ingreso', { proyectoId: 'obra-a' }), true);
    assert.equal(actorTienePermiso(depoA, 'almacen.ingreso', { proyectoId: 'obra-b' }), false);
  });

  it('sin proyectoId usa todos los roles de obra (legado)', () => {
    assert.equal(actorTienePermiso(depoA, 'almacen.ingreso'), true);
  });
});
