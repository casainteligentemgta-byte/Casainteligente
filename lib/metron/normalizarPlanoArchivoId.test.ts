/**
 * Ejecutar: npx tsx --test lib/metron/normalizarPlanoArchivoId.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarPlanoArchivoId } from './normalizarPlanoArchivoId';

describe('normalizarPlanoArchivoId', () => {
  it('acepta vacío', () => {
    assert.deepEqual(normalizarPlanoArchivoId(''), { ok: true, id: null });
    assert.deepEqual(normalizarPlanoArchivoId(null), { ok: true, id: null });
  });

  it('rechaza valores que no son UUID (p. ej. "1")', () => {
    assert.deepEqual(normalizarPlanoArchivoId('1'), { ok: false, recibido: '1' });
    assert.deepEqual(normalizarPlanoArchivoId('plano-1'), {
      ok: false,
      recibido: 'plano-1',
    });
  });

  it('acepta UUID válido', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    assert.deepEqual(normalizarPlanoArchivoId(id), { ok: true, id });
  });
});
