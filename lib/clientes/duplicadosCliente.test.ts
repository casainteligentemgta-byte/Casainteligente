import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase';
import { buscarClientesParecidos, clientesParecidos } from './duplicadosCliente';
import type { SupabaseClient } from '@supabase/supabase-js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const filas = [
  {
    id: A,
    nombre: 'Carlos',
    apellido: 'Pérez',
    rif: 'V-12.345.678',
    cedula: 'V-12.345.678',
    telefono: '0414-1234567',
    movil: '0414-1234567',
  },
  { id: B, nombre: 'Otra', rif: 'J-00000001-0', cedula: null, telefono: '0212-5550000', movil: null },
];

describe('clientesParecidos', () => {
  it('detecta el mismo RIF aunque esté escrito distinto', () => {
    const r = clientesParecidos(filas, { rif: 'V12345678' });
    assert.equal(r.length, 1);
    assert.equal(r[0].id, A);
    assert.equal(r[0].motivo, 'rif');
  });

  it('detecta el mismo teléfono 0414 vs +58', () => {
    const r = clientesParecidos(filas, { telefono: '+58 414 1234567' });
    assert.equal(r.length, 1);
    assert.equal(r[0].motivo, 'telefono');
  });

  it('ignora el propio id al editar', () => {
    assert.equal(clientesParecidos(filas, { rif: 'V-12.345.678', excludeId: A }).length, 0);
  });

  it('no marca coincidencia vacía', () => {
    assert.equal(clientesParecidos(filas, { rif: '', cedula: '', telefono: '' }).length, 0);
  });
});

describe('buscarClientesParecidos', () => {
  it('lee customers y devuelve el parecido', async () => {
    const sb = crearFakeSupabase({ customers: filas }) as unknown as SupabaseClient;
    const r = await buscarClientesParecidos(sb, { cedula: 'V12345678' });
    assert.equal(r.error, null);
    assert.equal(r.parecidos[0]?.id, A);
  });
});
