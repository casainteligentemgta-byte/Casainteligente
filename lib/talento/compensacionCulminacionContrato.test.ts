import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fmtCompensacionCulminacionUsdPlano,
  montoCompensacionCulminacionUsd,
  remuneracionSemanalUsdExpress,
} from '@/lib/talento/compensacionCulminacionContrato';

describe('compensacionCulminacionContrato', () => {
  it('compensación = remuneración semanal (prioridad sobre override)', () => {
    assert.equal(
      montoCompensacionCulminacionUsd({ remuneracionSemanalUsd: 70, compensacionExplicitUsd: 100 }),
      70,
    );
    assert.equal(montoCompensacionCulminacionUsd({ bonoSemanalUsd: 70 }), 70);
  });

  it('si no hay remuneración, usa override o fallback', () => {
    assert.equal(montoCompensacionCulminacionUsd({ compensacionExplicitUsd: 100 }), 100);
    assert.equal(montoCompensacionCulminacionUsd({ fallbackUsd: 100 }), 100);
    assert.equal(montoCompensacionCulminacionUsd({}), 0);
  });

  it('reconstruye rem legacy (complemento < tabulador)', () => {
    // 70 rem − 37.08 base = 32.92 complemento guardado
    assert.equal(
      remuneracionSemanalUsdExpress({ storedUsd: 32.92, ingresoTabuladorSemanalUsd: 37.08 }),
      70,
    );
    // Nuevo: ya guardaron la rem completa
    assert.equal(
      remuneracionSemanalUsdExpress({ storedUsd: 70, ingresoTabuladorSemanalUsd: 37.08 }),
      70,
    );
  });

  it('formatea plano es-VE o placeholder', () => {
    assert.equal(fmtCompensacionCulminacionUsdPlano(70), '70,00');
    assert.equal(fmtCompensacionCulminacionUsdPlano(0), '________');
  });
});
