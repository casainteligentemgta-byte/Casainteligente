import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fmtCompensacionCulminacionUsdPlano,
  montoCompensacionCulminacionUsd,
} from '@/lib/talento/compensacionCulminacionContrato';

describe('compensacionCulminacionContrato', () => {
  it('usa el bono semanal (1 semana por mes)', () => {
    assert.equal(
      montoCompensacionCulminacionUsd({ bonoSemanalUsd: 70, compensacionExplicitUsd: 100 }),
      70,
    );
  });

  it('si no hay bono, usa override o fallback', () => {
    assert.equal(montoCompensacionCulminacionUsd({ compensacionExplicitUsd: 100 }), 100);
    assert.equal(montoCompensacionCulminacionUsd({ fallbackUsd: 100 }), 100);
    assert.equal(montoCompensacionCulminacionUsd({}), 0);
  });

  it('formatea plano es-VE o placeholder', () => {
    assert.equal(fmtCompensacionCulminacionUsdPlano(70), '70,00');
    assert.equal(fmtCompensacionCulminacionUsdPlano(0), '________');
  });
});
