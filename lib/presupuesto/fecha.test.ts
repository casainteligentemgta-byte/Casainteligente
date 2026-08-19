/**
 * Tests: fecha de documento del presupuesto (editable, independiente de created_at).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  esErrorColumnaFecha,
  esFechaIso,
  fechaACreatedAtMediodiaCaracas,
  fechaDocumentoDeBudget,
  formatFechaPresupuestoCorta,
  formatFechaPresupuestoLarga,
  hoyFechaPresupuesto,
  isoAFechaInput,
} from './fecha';
import { buildPresupuestoPrintHtml } from './html-impresion';

describe('isoAFechaInput', () => {
  it('deja YYYY-MM-DD tal cual (columna date)', () => {
    assert.equal(isoAFechaInput('2024-03-05'), '2024-03-05');
  });

  it('convierte timestamptz a día en Caracas', () => {
    // 2024-03-05 00:30 UTC = 2024-03-04 20:30 en Caracas (UTC-4)
    assert.equal(isoAFechaInput('2024-03-05T00:30:00.000Z'), '2024-03-04');
    // 2024-03-05 12:00 UTC = 2024-03-05 08:00 en Caracas
    assert.equal(isoAFechaInput('2024-03-05T12:00:00.000Z'), '2024-03-05');
  });

  it('si falta valor, usa el día actual en Caracas', () => {
    const now = new Date('2026-08-19T08:00:00-04:00');
    assert.equal(isoAFechaInput(null, now), '2026-08-19');
    assert.equal(hoyFechaPresupuesto(now), '2026-08-19');
  });
});

describe('fechaDocumentoDeBudget', () => {
  it('prioriza fecha de documento sobre created_at', () => {
    assert.equal(
      fechaDocumentoDeBudget({ fecha: '2021-01-15', created_at: '2026-08-19T12:00:00.000Z' }),
      '2021-01-15',
    );
  });

  it('cae a created_at si no hay fecha', () => {
    assert.equal(
      fechaDocumentoDeBudget({ created_at: '2024-06-10T16:00:00.000Z' }),
      '2024-06-10',
    );
  });
});

describe('formatFechaPresupuesto', () => {
  it('larga no corre el día por UTC', () => {
    const s = formatFechaPresupuestoLarga('2024-03-05');
    assert.match(s, /5/);
    assert.match(s, /marzo/i);
    assert.match(s, /2024/);
  });

  it('corta muestra día y mes', () => {
    const s = formatFechaPresupuestoCorta('2024-03-05');
    assert.match(s, /5/);
  });
});

describe('esFechaIso / fallback columna', () => {
  it('valida YYYY-MM-DD', () => {
    assert.equal(esFechaIso('2026-08-19'), true);
    assert.equal(esFechaIso('19/08/2026'), false);
  });

  it('detecta error de PostgREST por columna fecha ausente', () => {
    assert.equal(
      esErrorColumnaFecha("Could not find the 'fecha' column of 'budgets' in the schema cache"),
      true,
    );
    assert.equal(esErrorColumnaFecha('duplicate key value'), false);
  });

  it('created_at fallback a mediodía Caracas', () => {
    assert.equal(fechaACreatedAtMediodiaCaracas('2024-03-05'), '2024-03-05T12:00:00-04:00');
  });
});

describe('buildPresupuestoPrintHtml fecha', () => {
  it('usa budgets.fecha y no created_at', () => {
    const html = buildPresupuestoPrintHtml({
      customer_name: 'Cliente Demo',
      customer_rif: 'J-1',
      subtotal: 10,
      items: [{ qty: 1, unit_price: 10, discount: 0, product_data: { nombre: 'Item' } }],
      numero_correlativo: 501,
      fecha: '2021-01-15',
      created_at: '2026-08-19T12:00:00.000Z',
    });
    assert.match(html, /15 de enero de 2021/i);
    assert.doesNotMatch(html, /19 de agosto de 2026/i);
  });
});
