import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COMANDOS_SOLO_NO_COMPRADOR, MENSAJE_NO_DISPONIBLE_COMPRADOR } from '@/lib/telegram/compradorRestricciones';

describe('comprador: sin ingreso ni salida de almacén', () => {
  it('bloquea todos los comandos de movimiento de almacén', () => {
    for (const k of ['comandoIngresoManual', 'comandoMenuIngreso', 'comandoIngresoFactura', 'comandoMenuSalida', 'comandoSalida']) {
      assert.ok(COMANDOS_SOLO_NO_COMPRADOR.includes(k as never), k);
    }
  });

  it('no bloquea facturas ni notas de entrega', () => {
    for (const k of ['comandoNotaEntrega', 'comandoEmergencia', 'comandoProcura']) {
      assert.ok(!COMANDOS_SOLO_NO_COMPRADOR.includes(k as never), k);
    }
  });

  it('el mensaje indica qué sí puede usar', () => {
    assert.match(MENSAJE_NO_DISPONIBLE_COMPRADOR, /\/facturas/);
    assert.match(MENSAJE_NO_DISPONIBLE_COMPRADOR, /\/nota/);
  });
});
