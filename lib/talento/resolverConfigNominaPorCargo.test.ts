import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolverConfigNominaPorCargo } from '@/lib/talento/resolverConfigNominaPorCargo';

const configs = [
  { id: 'ayu', cargo_nombre: 'Ayudante', nivel_salarial: 2 },
  { id: 'ayu-op', cargo_nombre: 'Ayudante de Operadores', nivel_salarial: 2 },
  { id: 'carp2', cargo_nombre: 'Carpintero de 2da.', nivel_salarial: 3 },
  { id: 'carp1', cargo_nombre: 'Carpintero de 1era.', nivel_salarial: 8 },
  { id: 'alb', cargo_nombre: 'Albañil', nivel_salarial: 5 },
  { id: 'op', cargo_nombre: 'Operador de Equipo Liviano', nivel_salarial: 3 },
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
    assert.equal(r!.id, 'alb');
  });

  it('OPERADOR encuentra operador de equipo', () => {
    const r = resolverConfigNominaPorCargo('OPERADOR', configs);
    assert.ok(r);
    assert.equal(r!.id, 'op');
  });

  it('cargo desconocido → null', () => {
    assert.equal(resolverConfigNominaPorCargo('ASTRONAUTA', configs), null);
  });
});
