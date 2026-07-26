/**
 * Ejecutar: npx tsx --test lib/contabilidad/cco/procesarLoteSoportesCliente.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { egresosDesdeFilasSinDoc } from './procesarLoteSoportesCliente';

describe('procesarLoteSoportesCliente', () => {
  it('mapea filas del cuadro a candidatos de match', () => {
    const egresos = egresosDesdeFilasSinDoc([
      {
        id: 'c1',
        proveedor: 'ACME',
        fecha: '2026-03-01',
        moneda: 'USD',
        monto_orig: 10,
        monto_base_usd: 10,
        tasa: 1,
        invoice_number: '1',
        display_id: 99,
      },
    ]);
    assert.equal(egresos.length, 1);
    assert.equal(egresos[0]!.id, 'c1');
    assert.equal(egresos[0]!.proveedor, 'ACME');
    assert.equal(egresos[0]!.display_id, 99);
  });
});
