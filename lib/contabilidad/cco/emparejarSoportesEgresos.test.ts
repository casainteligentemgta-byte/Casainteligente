/**
 * Tests unitarios del scoring (sin Gemini).
 * Ejecutar: npx tsx --test lib/contabilidad/cco/emparejarSoportesEgresos.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirMatchFacturaEgresos,
  puntuarEgresoContraFactura,
  type EgresoCandidatoSoporte,
} from './emparejarSoportesEgresosScoring';

const baseEgreso = (over: Partial<EgresoCandidatoSoporte> = {}): EgresoCandidatoSoporte => ({
  id: 'e1',
  proveedor: 'FERRETERIA EL CLAVO C.A.',
  fecha: '2025-03-15',
  moneda: 'VES',
  monto_orig: 15000,
  monto_base_usd: 150,
  tasa: 100,
  invoice_number: '00-1234',
  ...over,
});

describe('emparejarSoportesEgresos scoring', () => {
  it('auto cuando proveedor + fecha + monto coinciden', () => {
    const r = decidirMatchFacturaEgresos(
      {
        invoice_number: '00-1234',
        supplier_name: 'Ferreteria El Clavo C.A.',
        date: '2025-03-15',
        total_amount: 15000,
      },
      [baseEgreso(), baseEgreso({ id: 'e2', proveedor: 'Otro SA', monto_orig: 999 })],
    );
    assert.equal(r.decision, 'auto');
    assert.equal(r.egresoId, 'e1');
    assert.ok(r.confianza >= 78);
  });

  it('duda o sin_match si solo coincide proveedor', () => {
    const r = decidirMatchFacturaEgresos(
      {
        invoice_number: '',
        supplier_name: 'Ferreteria El Clavo',
        date: '2024-01-01',
        total_amount: 1,
      },
      [baseEgreso()],
    );
    assert.ok(r.decision === 'duda' || r.decision === 'sin_match');
    assert.ok(r.confianza < 78);
  });

  it('puntúa monto USD convertido con tasa', () => {
    const score = puntuarEgresoContraFactura(
      {
        supplier_name: 'Ferreteria El Clavo C.A.',
        date: '2025-03-15',
        total_amount: 15000,
        invoice_number: '',
      },
      baseEgreso({ moneda: 'USD', monto_orig: 150, monto_base_usd: 150, tasa: 100 }),
    );
    assert.ok(score.desglose.monto >= 18);
  });

  it('sin_match si no hay señales', () => {
    const r = decidirMatchFacturaEgresos(
      {
        invoice_number: 'X',
        supplier_name: 'Completamente Distinto',
        date: '2020-01-01',
        total_amount: 999999,
      },
      [baseEgreso()],
    );
    assert.equal(r.decision, 'sin_match');
  });
});
