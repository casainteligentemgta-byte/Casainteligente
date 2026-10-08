import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  alimentacionMensualUsdAnclada,
  alimentacionSemanalUsdAnclada,
  TASA_BCV_FIRMA_ACUERDO_2026,
} from '@/lib/nomina/tabuladorHomologado2026';
import { cestaSemanalUsdAnclada, TASA_ANCLA_CESTA_BCV } from '@/lib/nomina/reglasPagoObra';

describe('cesta ticket en dólares', () => {
  it('Bs. 135.188 a la tasa del día de la firma del acuerdo (772,5441)', () => {
    assert.equal(TASA_BCV_FIRMA_ACUERDO_2026, 772.5441);
    assert.equal(alimentacionMensualUsdAnclada(), 174.99);
    assert.equal(alimentacionSemanalUsdAnclada(), 40.38);
  });
  it('la nómina usa el mismo monto semanal que el contrato', () => {
    assert.equal(cestaSemanalUsdAnclada(TASA_ANCLA_CESTA_BCV), alimentacionSemanalUsdAnclada());
  });
});
