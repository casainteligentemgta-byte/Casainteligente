import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { uuidV4 } from '@/lib/registro/uuidCompat';
import { celularDesdeEntrada } from '@/lib/registro/catalogosHojaVidaVe';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV4', () => {
  it('da un UUID v4 válido con y sin crypto.randomUUID', () => {
    assert.match(uuidV4(), UUID_V4);
    const original = globalThis.crypto.randomUUID;
    try {
      (globalThis.crypto as { randomUUID?: unknown }).randomUUID = undefined;
      for (let i = 0; i < 20; i++) assert.match(uuidV4(), UUID_V4);
    } finally {
      (globalThis.crypto as { randomUUID?: unknown }).randomUUID = original;
    }
  });
});

describe('celularDesdeEntrada', () => {
  it('número de 7 dígitos: conserva el prefijo elegido', () => {
    assert.equal(celularDesdeEntrada('0416', '1234567'), '04161234567');
  });
  it('número completo escrito en la casilla: separa el prefijo', () => {
    assert.equal(celularDesdeEntrada('0414', '04241234567'), '04241234567');
    assert.equal(celularDesdeEntrada('0414', '+58 424 123 4567'), '04241234567');
  });
});
