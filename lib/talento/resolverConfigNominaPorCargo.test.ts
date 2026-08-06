import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolverConfigNominaPorCargo } from '@/lib/talento/resolverConfigNominaPorCargo';

const configs = [
  { id: 'ayu', cargo_nombre: 'Ayudante', nivel_salarial: 2 },
  { id: 'ayu-op', cargo_nombre: 'Ayudante de Operadores', nivel_salarial: 2 },
  { id: 'ayu-topo', cargo_nombre: 'Ayudante de Topógrafo', nivel_salarial: 2 },
  { id: 'carp2', cargo_nombre: 'Carpintero de 2da.', nivel_salarial: 3 },
  { id: 'carp1', cargo_nombre: 'Carpintero de 1era.', nivel_salarial: 8 },
  { id: 'alb2', cargo_nombre: 'Albañil de 2da.', nivel_salarial: 3 },
  { id: 'alb1', cargo_nombre: 'Albañil de 1ra.', nivel_salarial: 5 },
  { id: 'op', cargo_nombre: 'Operador de Equipo Liviano', nivel_salarial: 3 },
  { id: 'cap', cargo_nombre: 'Caporal', nivel_salarial: 3 },
  { id: 'mo2', cargo_nombre: 'Maestro de Obra de 2da.', nivel_salarial: 7 },
  { id: 'mo1', cargo_nombre: 'Maestro de Obra de 1ra.', nivel_salarial: 9 },
];

describe('resolverConfigNominaPorCargo', () => {
  it('AYUDANTE → Ayudante (no el más largo)', () => {
    const r = resolverConfigNominaPorCargo('AYUDANTE', configs);
    assert.ok(r);
    assert.equal(r!.id, 'ayu');
  });

  it('CARPINTERO + nivel 8 → Carpintero de 1era.', () => {
    const r = resolverConfigNominaPorCargo('CARPINTERO', configs, { nivelGenerico: 8 });
    assert.ok(r);
    assert.equal(r!.id, 'carp1');
  });

  it('ALBAÑIL coincide sin acento', () => {
    const r = resolverConfigNominaPorCargo('ALBAÑIL', configs);
    assert.ok(r);
    assert.ok(r!.id === 'alb1' || r!.id === 'alb2');
  });

  it('OPERADOR prefiere operador de equipo liviano', () => {
    const r = resolverConfigNominaPorCargo('OPERADOR', [
      ...configs,
      { id: 'op-ali', cargo_nombre: 'Operador de Aliva', nivel_salarial: 4 },
    ]);
    assert.ok(r);
    assert.equal(r!.id, 'op');
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

  it('INGENIERO SUPERVISOR → Maestro de Obra', () => {
    const r = resolverConfigNominaPorCargo('INGENIERO SUPERVISOR', configs);
    assert.ok(r);
    assert.ok(r!.id === 'mo1' || r!.id === 'mo2');
  });

  it('cargo desconocido → null', () => {
    assert.equal(resolverConfigNominaPorCargo('ASTRONAUTA', configs), null);
  });
});
