import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase';
import {
  cargarCobrosCliente,
  normalizarAbonoObra,
  normalizarAbonoPresupuesto,
  unirCobrosCliente,
} from './cobrosCliente';

const CLIENTE = '11111111-1111-4111-8111-111111111111';

describe('normalizar cobros del cliente', () => {
  it('toma fecha, monto, moneda y método del abono de presupuesto', () => {
    const c = normalizarAbonoPresupuesto({
      id: 'a1',
      monto: 100,
      moneda: 'USD',
      monto_usd: 100,
      metodo: 'zelle',
      fecha_abono: '2026-03-01',
    });
    assert.equal(c?.monto, 100);
    assert.equal(c?.moneda, 'USD');
    assert.equal(c?.metodo, 'Zelle');
    assert.equal(c?.fecha, '2026-03-01');
    assert.equal(c?.origen, 'presupuesto');
  });

  it('en obra usa banco como método y el monto recibido', () => {
    const c = normalizarAbonoObra(
      {
        id: 'o1',
        monto_recibido: 500,
        moneda: 'USD',
        monto_usd: 500,
        banco_origen: 'Banesco',
        fecha_abono: '2026-04-02',
      },
      'Obra Sur',
    );
    assert.equal(c?.monto, 500);
    assert.match(c?.metodo ?? '', /Banesco/);
    assert.equal(c?.etiquetaOrigen, 'Obra Sur');
  });

  it('ordena del más reciente al más antiguo', () => {
    const a = normalizarAbonoPresupuesto({
      id: '1',
      monto: 1,
      moneda: 'USD',
      monto_usd: 1,
      metodo: 'efectivo',
      fecha_abono: '2026-01-01',
    })!;
    const b = normalizarAbonoPresupuesto({
      id: '2',
      monto: 2,
      moneda: 'USD',
      monto_usd: 2,
      metodo: 'efectivo',
      fecha_abono: '2026-02-01',
    })!;
    assert.deepEqual(
      unirCobrosCliente([a, b]).map((x) => x.id),
      ['presupuesto:2', 'presupuesto:1'],
    );
  });
});

describe('cargarCobrosCliente', () => {
  it('junta abonos de presupuestos y de obras del cliente', async () => {
    const sb = crearFakeSupabase({
      budgets: [{ id: 'b1', customer_id: CLIENTE }],
      ci_proyectos: [{ id: 'p1', customer_id: CLIENTE, nombre: 'Torre' }],
      budget_abonos: [
        {
          id: 'ba1',
          budget_id: 'b1',
          monto: 80,
          moneda: 'USD',
          monto_usd: 80,
          metodo: 'transferencia',
          fecha_abono: '2026-05-01',
        },
      ],
      ci_proyecto_abonos: [
        {
          id: 'pa1',
          proyecto_id: 'p1',
          monto_recibido: 200,
          moneda: 'USD',
          monto_usd: 200,
          banco_origen: 'Mercantil',
          fecha_abono: '2026-06-01',
        },
      ],
    }) as unknown as SupabaseClient;

    const r = await cargarCobrosCliente(sb, CLIENTE);
    assert.equal(r.error, null);
    assert.equal(r.cobros.length, 2);
    assert.equal(r.cobros[0]?.origen, 'obra');
    assert.equal(r.cobros[1]?.origen, 'presupuesto');
  });
});
