/**
 * Ejecutar: npx tsx --test lib/rrhh/vinculosContratacionProyecto.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  agregarVinculoContrato,
  empleadoEstaContratado,
} from './vinculosContratacionProyecto';

describe('vinculosContratacionProyecto', () => {
  it('no trata HV/vacante como contratación', () => {
    const map = new Map<string, Set<string>>();
    assert.equal(empleadoEstaContratado(map, 'emp-luis'), false);
    agregarVinculoContrato(map, 'emp-luis', 'obra-1');
    assert.equal(empleadoEstaContratado(map, 'emp-luis'), true);
    assert.equal(empleadoEstaContratado(map, 'emp-otro'), false);
  });

  it('ignora ids vacíos', () => {
    const map = new Map<string, Set<string>>();
    agregarVinculoContrato(map, '', 'obra-1');
    agregarVinculoContrato(map, 'emp-1', '  ');
    assert.equal(map.size, 0);
  });
});
