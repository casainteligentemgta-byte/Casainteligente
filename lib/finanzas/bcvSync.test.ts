import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  debeAlertarSyncTasaBcv,
  decidirUpsertTasaBcv,
  mensajeAlertaTasaBcv,
} from './bcvSync';
import { fechaAlmacenamientoTasaBcv } from './bcvOficial';

describe('upsert idempotente de ci_tasas_bcv', () => {
  it('inserta si no hay fila', () => {
    assert.equal(
      decidirUpsertTasaBcv({
        existente: null,
        candidato: {
          fecha: '2026-11-06',
          usd: 896.1225,
          fuente: 'bcv.org.ve',
          fecha_valor: '2026-11-06',
        },
      }),
      'insert',
    );
  });

  it('no pisa una fila oficial con un agregador', () => {
    assert.equal(
      decidirUpsertTasaBcv({
        existente: { fuente: 'bcv.org.ve' },
        candidato: {
          fecha: '2026-11-06',
          usd: 890,
          fuente: 'bcv.today',
          fecha_valor: '2026-11-06',
        },
      }),
      'keep',
    );
  });

  it('actualiza si llega la oficial o el mismo origen', () => {
    assert.equal(
      decidirUpsertTasaBcv({
        existente: { fuente: 'bcv.today' },
        candidato: {
          fecha: '2026-11-06',
          usd: 896.1225,
          fuente: 'bcv.org.ve',
          fecha_valor: '2026-11-06',
        },
      }),
      'update',
    );
    assert.equal(
      decidirUpsertTasaBcv({
        existente: { fuente: 'bcv.org.ve' },
        candidato: {
          fecha: '2026-11-06',
          usd: 896.1225,
          fuente: 'bcv.org.ve',
          fecha_valor: '2026-11-06',
        },
      }),
      'update',
    );
  });
});

describe('alerta de sync BCV', () => {
  it('alerta si no hay tasa de hoy', () => {
    assert.equal(debeAlertarSyncTasaBcv({ filaHoy: null }), 'sin_tasa_hoy');
    assert.match(
      mensajeAlertaTasaBcv({ hoy: '2026-11-06', motivo: 'sin_tasa_hoy' }),
      /No hay tasa oficial para <b>2026-11-06<\/b>/,
    );
  });

  it('alerta si se usó fallback y no la portada oficial', () => {
    assert.equal(debeAlertarSyncTasaBcv({ filaHoy: { fuente: 'bcv.today' } }), 'fallback');
    assert.equal(debeAlertarSyncTasaBcv({ filaHoy: { fuente: 'bcv.org.ve' } }), null);
  });
});

describe('el scrape de una Fecha Valor vieja no cubre hoy', () => {
  it('el 6 nov con HTML del 4 nov no deja fila de hoy', () => {
    const fechaGuardada = fechaAlmacenamientoTasaBcv({
      fechaValor: '2026-11-04',
      hoy: '2026-11-06',
    });
    assert.equal(fechaGuardada, '2026-11-04');
    assert.equal(
      debeAlertarSyncTasaBcv({
        filaHoy: fechaGuardada === '2026-11-06' ? { fuente: 'bcv.org.ve' } : null,
      }),
      'sin_tasa_hoy',
    );
  });
});
