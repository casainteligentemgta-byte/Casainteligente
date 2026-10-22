import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularRelacionSemanal, porcentajeVigente } from './relacionGastosSemanal';

const tramos = [
  { porcentaje: 15, vigente_desde: '2026-01-01' },
  { porcentaje: 12, vigente_desde: '2026-10-01' },
];

describe('porcentajeVigente', () => {
  it('usa el tramo vigente a la fecha, no el actual', () => {
    assert.equal(porcentajeVigente(tramos, '2026-09-30'), 15);
    assert.equal(porcentajeVigente(tramos, '2026-10-01'), 12);
  });
  it('sin historial devuelve null', () => {
    assert.equal(porcentajeVigente([], '2026-10-01'), null);
  });
});

describe('calcularRelacionSemanal', () => {
  it('suma gastos, aplica 15 % y calcula el saldo contra fondos', () => {
    const r = calcularRelacionSemanal({
      desde: '2026-10-05',
      hasta: '2026-10-11',
      gastos: [
        { fecha: '2026-10-05', monto_usd: 1000 },
        { fecha: '2026-10-09', monto_usd: 500 },
        { fecha: '2026-10-20', monto_usd: 9999 }, // fuera de la semana
      ],
      fondos: [{ fecha: '2026-10-06', monto_usd: 1000 }],
      tramos: [{ porcentaje: 15, vigente_desde: '2026-01-01' }],
    });
    assert.equal(r.gastos_usd, 1500);
    assert.equal(r.administracion_usd, 225);
    assert.equal(r.total_a_reponer_usd, 1725);
    assert.equal(r.fondos_recibidos_usd, 1000);
    assert.equal(r.saldo_usd, -725);
  });

  it('usa el % vigente al cierre de la semana si cambió a mitad de mes', () => {
    const r = calcularRelacionSemanal({
      desde: '2026-09-28',
      hasta: '2026-10-04',
      gastos: [{ fecha: '2026-09-30', monto_usd: 100 }],
      fondos: [],
      tramos,
    });
    assert.equal(r.porcentaje, 12);
    assert.equal(r.administracion_usd, 12);
  });
});
