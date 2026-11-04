import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estadoHerramientaObra,
  parseCostoDiario,
  payloadAsignarHerramienta,
  payloadDevolverHerramienta,
} from './asignarHerramienta';

describe('estadoHerramientaObra', () => {
  it('en obra solo si tiene proyecto y no está devuelta', () => {
    assert.equal(estadoHerramientaObra({ proyecto_id: 'p1', fecha_devolucion: null }), 'en_obra');
    assert.equal(estadoHerramientaObra({ proyecto_id: 'p1', fecha_devolucion: '2026-11-02' }), 'disponible');
    assert.equal(estadoHerramientaObra({ proyecto_id: null, fecha_devolucion: null }), 'disponible');
  });
});

describe('payloads asignar / devolver', () => {
  it('asignar limpia devolución y exige obra', () => {
    const p = payloadAsignarHerramienta({
      proyectoId: 'obra-1',
      fechaAsignacion: '2026-11-03',
      costoDiario: 4.5,
    });
    assert.equal(p.proyecto_id, 'obra-1');
    assert.equal(p.fecha_asignacion, '2026-11-03');
    assert.equal(p.fecha_devolucion, null);
    assert.equal(p.costo_diario, 4.5);
    assert.throws(() => payloadAsignarHerramienta({ proyectoId: '  ' }), /obra/i);
  });

  it('devolver solo pone fecha_devolucion', () => {
    const p = payloadDevolverHerramienta({ fechaDevolucion: '2026-11-03' });
    assert.equal(p.fecha_devolucion, '2026-11-03');
    assert.equal(Object.keys(p).length, 1);
  });
});

describe('parseCostoDiario', () => {
  it('acepta coma decimal y vacío', () => {
    assert.equal(parseCostoDiario('3,5'), 3.5);
    assert.equal(parseCostoDiario(''), null);
    assert.equal(parseCostoDiario('-1'), null);
  });
});
