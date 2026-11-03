import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AVISO_STATUS_SOLO_ABONOS,
  esEstadoCobroSoloAbonos,
  puedeCambiarStatusLibre,
} from './estadosCobro';

describe('estados de cobro del presupuesto', () => {
  it('pagado, cobrado y parcial solo vía abonos', () => {
    for (const s of ['pagado', 'cobrado', 'parcialmente_pagado']) {
      assert.equal(esEstadoCobroSoloAbonos(s), true, s);
      assert.equal(puedeCambiarStatusLibre(s), false, s);
    }
  });

  it('el resto se puede elegir en la lista', () => {
    for (const s of ['no_enviado', 'enviado', 'aprobado', 'no_aprobado']) {
      assert.equal(puedeCambiarStatusLibre(s), true, s);
      assert.equal(esEstadoCobroSoloAbonos(s), false, s);
    }
  });

  it('explica por qué no se marca a mano', () => {
    assert.match(AVISO_STATUS_SOLO_ABONOS, /abonos/);
  });
});
