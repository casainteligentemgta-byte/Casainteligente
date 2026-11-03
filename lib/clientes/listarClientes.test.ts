import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase';
import { contarObrasPorCliente, listarClientesCrm, mapearClienteLista } from './listarClientes';
import type { SupabaseClient } from '@supabase/supabase-js';

const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';

describe('mapearClienteLista', () => {
  it('distingue persona y empresa y pone la etiqueta de documento', () => {
    const p = mapearClienteLista(
      { id: C1, nombre: 'Ana Ruiz', customer_type: 'natural', cedula: 'V-1', rif: '', email: 'a@b.com', movil: '0414111' },
      2,
    );
    assert.equal(p.categoria, 'personal');
    assert.equal(p.rif, 'Cédula: V-1');
    assert.equal(p.obraCount, 2);

    const e = mapearClienteLista(
      { id: C2, nombre: 'Dimaquinas', customer_type: 'juridico', rif: 'J-1', tipo: 'Juridico' },
      0,
    );
    assert.equal(e.categoria, 'empresa');
    assert.equal(e.rif, 'RIF: J-1');
  });
});

describe('contarObrasPorCliente', () => {
  it('si el RPC no existe cuenta solo customer_id, no toda la obra', async () => {
    const sb = crearFakeSupabase({
      ci_proyectos: [
        { id: 'o1', customer_id: C1 },
        { id: 'o2', customer_id: C1 },
        { id: 'o3', customer_id: C2 },
      ],
    }) as unknown as SupabaseClient;
    const map = await contarObrasPorCliente(sb, [C1, C2]);
    assert.equal(map.get(C1), 2);
    assert.equal(map.get(C2), 1);
  });
});

describe('listarClientesCrm', () => {
  it('no pide select * y adjunta el conteo de obras', async () => {
    const sb = crearFakeSupabase({
      customers: [
        {
          id: C1,
          nombre: 'Luis',
          customer_type: 'natural',
          created_at: '2026-01-01T00:00:00Z',
          status: 'activo',
        },
      ],
      ci_proyectos: [{ id: 'o1', customer_id: C1 }],
    }) as unknown as SupabaseClient;
    const r = await listarClientesCrm(sb);
    assert.equal(r.error, null);
    assert.equal(r.lista.length, 1);
    assert.equal(r.lista[0].obraCount, 1);
    assert.equal(r.lista[0].nombre, 'Luis');
  });
});
