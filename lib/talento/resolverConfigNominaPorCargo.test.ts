import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cargoLabelEspecificaGrado,
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
  { id: 'pint2', cargo_nombre: 'Pintor de 2da.', nivel_salarial: 3 },
  { id: 'pint1', cargo_nombre: 'Pintor de 1ra.', nivel_salarial: 5 },
];

describe('resolverConfigNominaPorCargo', () => {
  it('detecta si el label ya trae grado', () => {
    assert.equal(cargoLabelEspecificaGrado('CARPINTERO'), false);
    assert.equal(cargoLabelEspecificaGrado('CARPINTERO DE 2DA'), true);
    assert.equal(cargoLabelEspecificaGrado('Albañil de 1era.'), true);
  });

  it('AYUDANTE → Ayudante (no el más largo)', () => {
    const r = resolverConfigNominaPorCargo('AYUDANTE', configs);
    assert.ok(r);
    assert.equal(r!.id, 'ayu');
  });

  it('CARPINTERO sin grado → Carpintero de 1era.', () => {
    const r = resolverConfigNominaPorCargo('CARPINTERO', configs);
    assert.ok(r);
    assert.equal(r!.id, 'carp1');
  });

  it('CARPINTERO DE 2DA → respeta el grado indicado', () => {
    const r = resolverConfigNominaPorCargo('CARPINTERO DE 2DA', configs);
    assert.ok(r);
    assert.equal(r!.id, 'carp2');
  });

  it('ALBAÑIL sin grado → Albañil de 1ra.', () => {
    const r = resolverConfigNominaPorCargo('ALBAÑIL', configs);
    assert.ok(r);
    assert.equal(r!.id, 'alb1');
  });

  it('OBRERO sin grado → Obrero de 1era.', () => {
    const r = resolverConfigNominaPorCargo('OBRERO', configs);
    assert.ok(r);
    assert.equal(r!.id, 'obr1');
  });

  it('PINTOR sin grado → Pintor de 1ra.', () => {
    const r = resolverConfigNominaPorCargo('PINTOR', configs);
    assert.ok(r);
    assert.equal(r!.id, 'pint1');
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

  it('INGENIERO SUPERVISOR → Maestro de Obra de 1ra.', () => {
    const r = resolverConfigNominaPorCargo('INGENIERO SUPERVISOR', configs);
    assert.ok(r);
    assert.equal(r!.id, 'mo1');
  });

  it('cargo desconocido → null', () => {
    assert.equal(resolverConfigNominaPorCargo('ASTRONAUTA', configs), null);
  });
});
