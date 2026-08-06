import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  oficioRasoParaContrato,
  resolverConfigNominaPorCargo,
} from '@/lib/talento/resolverConfigNominaPorCargo';

const configs = [
  { id: 'ayu', cargo_nombre: 'Ayudante', nivel_salarial: 2 },
  { id: 'ayu-op', cargo_nombre: 'Ayudante de Operadores', nivel_salarial: 2 },
  { id: 'ayu-topo', cargo_nombre: 'Ayudante de Topógrafo', nivel_salarial: 2 },
  { id: 'carp2', cargo_nombre: 'Carpintero de 2da.', nivel_salarial: 3 },
  { id: 'carp1', cargo_nombre: 'Carpintero de 1era.', nivel_salarial: 8 },
  { id: 'alb2', cargo_nombre: 'Albañil de 2da.', nivel_salarial: 3 },
  { id: 'alb1', cargo_nombre: 'Albañil de 1ra.', nivel_salarial: 5 },
  { id: 'obr1', cargo_nombre: 'Obrero de 1era.', nivel_salarial: 1 },
  { id: 'op', cargo_nombre: 'Operador de Equipo Liviano', nivel_salarial: 3 },
  { id: 'cap', cargo_nombre: 'Caporal', nivel_salarial: 3 },
  { id: 'mo2', cargo_nombre: 'Maestro de Obra de 2da.', nivel_salarial: 7 },
  { id: 'mo1', cargo_nombre: 'Maestro de Obra de 1ra.', nivel_salarial: 9 },
];

describe('resolverConfigNominaPorCargo (oficios rasos)', () => {
  it('AYUDANTE → Ayudante', () => {
    const r = resolverConfigNominaPorCargo('AYUDANTE', configs);
    assert.ok(r);
    assert.equal(r!.id, 'ayu');
  });

  it('CARPINTERO DE 2DA → respeta el grado', () => {
    const r = resolverConfigNominaPorCargo('CARPINTERO DE 2DA', configs);
    assert.ok(r);
    assert.equal(r!.id, 'carp2');
  });

  it('oficioRasoParaContrato quita el grado', () => {
    assert.equal(oficioRasoParaContrato('Carpintero de 1era.'), 'CARPINTERO');
    assert.equal(oficioRasoParaContrato('AYUDANTE'), 'AYUDANTE');
    assert.equal(oficioRasoParaContrato('Albañil de 2da.'), 'ALBAÑIL');
  });

  it('TOPOGRAFO → Ayudante de Topógrafo', () => {
    const r = resolverConfigNominaPorCargo('TOPOGRAFO', configs);
    assert.ok(r);
    assert.equal(r!.id, 'ayu-topo');
  });

  it('UTILITIS → Ayudante', () => {
    const r = resolverConfigNominaPorCargo('UTILITIS', configs);
    assert.ok(r);
    assert.equal(r!.id, 'ayu');
  });
});
