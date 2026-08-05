import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CARGOS_OBREROS } from '@/lib/constants/cargosObreros';
import {
  laboresContratoDesdeCargo,
  laboresOficioPorCodigo,
  laboresOficioPorNombre,
  listarLaboresOficiosContrato,
} from '@/lib/talento/laboresOficioContrato';

describe('laboresOficioContrato', () => {
  it('cubre los 102 oficios del tabulador', () => {
    const list = listarLaboresOficiosContrato();
    assert.equal(list.length, CARGOS_OBREROS.length);
    assert.equal(list.length, 102);
    for (const c of CARGOS_OBREROS) {
      const row = laboresOficioPorCodigo(c.codigo);
      assert.ok(row, `falta ${c.codigo}`);
      assert.ok(row!.labores.trim().length > 10, `labores cortas ${c.codigo}`);
    }
  });

  it('resuelve por nombre de cargo', () => {
    const row = laboresOficioPorNombre('ALBAÑIL DE 1ra.');
    assert.equal(row?.codigo, '5.1');
    assert.match(row!.labores, /albañilería/i);
  });

  it('auto-rellena cuando no hay funciones en BD', () => {
    const t = laboresContratoDesdeCargo({
      cargoCodigo: '5.1',
      cargoNombre: 'ALBAÑIL DE 1ra.',
    });
    assert.match(t, /albañilería/i);
  });

  it('respeta override de funciones_oficiales distinto al nombre', () => {
    const t = laboresContratoDesdeCargo({
      cargoCodigo: '5.1',
      cargoNombre: 'ALBAÑIL DE 1ra.',
      funcionesOficiales: 'Levantar muros de bloque según plano especial de la obra.',
    });
    assert.match(t, /plano especial/i);
  });

  it('ignora override que solo repite el nombre del cargo', () => {
    const t = laboresContratoDesdeCargo({
      cargoCodigo: '1.1',
      cargoNombre: 'OBRERO DE 1era.',
      funcionesOficiales: 'OBRERO DE 1era.',
    });
    assert.match(t, /Excavaciones/i);
  });
});
