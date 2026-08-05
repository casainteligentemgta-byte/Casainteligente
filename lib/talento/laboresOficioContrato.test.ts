import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fraseLaboresOficioContrato,
  laboresContratoDesdeCargo,
  laboresOficioPorCodigo,
  laboresOficioPorNombre,
  listarLaboresOficiosContrato,
} from '@/lib/talento/laboresOficioContrato';

describe('laboresOficioContrato', () => {
  it('solo incluye oficios con ficha gaceta (45)', () => {
    const list = listarLaboresOficiosContrato();
    assert.equal(list.length, 45);
    for (const row of list) {
      assert.equal(row.fuente, 'gaceta');
      assert.ok(row.labores.trim().length > 10);
    }
  });

  it('resuelve por código/nombre gaceta', () => {
    assert.equal(laboresOficioPorCodigo('5.17')?.nombre, 'SOLDADOR DE 1ra.');
    assert.equal(laboresOficioPorNombre('ALBAÑIL DE 1ra.'), null);
    assert.equal(laboresOficioPorNombre('SOLDADOR DE 1ra.')?.codigo, '5.17');
  });

  it('sin ficha gaceta → vacío (no inventa labores)', () => {
    const t = laboresContratoDesdeCargo({
      cargoCodigo: '5.1',
      cargoNombre: 'ALBAÑIL DE 1ra.',
    });
    assert.equal(t, '');
    assert.equal(
      fraseLaboresOficioContrato({ cargoCodigo: '5.1', cargoNombre: 'ALBAÑIL DE 1ra.' }),
      '',
    );
  });

  it('auto-rellena con labores gaceta', () => {
    const t = laboresContratoDesdeCargo({
      cargoCodigo: '1.1',
      cargoNombre: 'OBRERO DE 1era.',
    });
    assert.match(t, /Excavaciones/i);
    assert.match(
      fraseLaboresOficioContrato({ cargoCodigo: '1.1', cargoNombre: 'OBRERO DE 1era.' }),
      /labores principales/i,
    );
  });

  it('respeta override de funciones_oficiales', () => {
    const t = laboresContratoDesdeCargo({
      cargoCodigo: '5.1',
      cargoNombre: 'ALBAÑIL DE 1ra.',
      funcionesOficiales: 'Levantar muros de bloque según plano especial de la obra.',
    });
    assert.match(t, /plano especial/i);
  });
});
