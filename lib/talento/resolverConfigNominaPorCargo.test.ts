import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  oficioTieneGradosEnTabulador,
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

describe('resolverConfigNominaPorCargo (grado Gaceta)', () => {
  it('detecta oficios con/sin grados en tabulador', () => {
    assert.equal(oficioTieneGradosEnTabulador('CARPINTERO', configs), true);
    assert.equal(oficioTieneGradosEnTabulador('AYUDANTE', configs), false);
    assert.equal(oficioTieneGradosEnTabulador('CAPORAL', configs), false);
  });

  it('AYUDANTE (sin niveles en Gaceta) → Ayudante', () => {
    const r = resolverConfigNominaPorCargo('AYUDANTE', configs);
    assert.ok(r);
    assert.equal(r!.id, 'ayu');
  });

  it('CARPINTERO sin nivel → Carpintero de 1era. (igual a 1era)', () => {
    const r = resolverConfigNominaPorCargo('CARPINTERO', configs);
    assert.ok(r);
    assert.equal(r!.id, 'carp1');
  });

  it('ALBAÑIL sin nivel → Albañil de 1ra.', () => {
    const r = resolverConfigNominaPorCargo('ALBAÑIL', configs);
    assert.ok(r);
    assert.equal(r!.id, 'alb1');
  });

  it('OBRERO sin nivel → Obrero de 1era.', () => {
    const r = resolverConfigNominaPorCargo('OBRERO', configs);
    assert.ok(r);
    assert.equal(r!.id, 'obr1');
  });

  it('CARPINTERO DE 2DA → respeta el grado indicado', () => {
    const r = resolverConfigNominaPorCargo('CARPINTERO DE 2DA', configs);
    assert.ok(r);
    assert.equal(r!.id, 'carp2');
  });

  it('TOPOGRAFO → Ayudante de Topógrafo', () => {
    const r = resolverConfigNominaPorCargo('TOPOGRAFO', configs);
    assert.ok(r);
    assert.equal(r!.id, 'ayu-topo');
  });

  it('INGENIERO SUPERVISOR → Maestro de Obra de 1ra.', () => {
    const r = resolverConfigNominaPorCargo('INGENIERO SUPERVISOR', configs);
    assert.ok(r);
    assert.equal(r!.id, 'mo1');
  });
});
