import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase';
import {
  cargarPresupuestosCliente,
  contarVinculosCliente,
  etiquetaEstadoPresupuesto,
  motivoNoBorrarCliente,
  normalizarPresupuestosCliente,
  numeroWhatsapp,
  presupuestoAceptado,
  resumenPresupuestosCliente,
  tonoEstadoPresupuesto,
} from './presupuestosCliente';
import type { SupabaseClient } from '@supabase/supabase-js';

const CLIENTE = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';

function base(tablas: Record<string, Array<Record<string, unknown>>>, ausentes: string[] = []) {
  return crearFakeSupabase(tablas, { tablasAusentes: ausentes }) as unknown as SupabaseClient;
}

describe('estado de un presupuesto', () => {
  it('aceptado = aprobado, por pagar, pago parcial o pagado', () => {
    for (const s of ['aprobado', 'cobrado', 'parcialmente_pagado', 'pagado']) assert.equal(presupuestoAceptado(s), true, s);
    for (const s of ['enviado', 'no_enviado', 'no_aprobado', '', null, undefined]) {
      assert.equal(presupuestoAceptado(s), false, String(s));
    }
  });

  it('usa las mismas palabras que la pantalla Presupuestos', () => {
    assert.equal(etiquetaEstadoPresupuesto('cobrado'), 'Por pagar');
    assert.equal(etiquetaEstadoPresupuesto('pagado'), 'Pagado');
    assert.equal(etiquetaEstadoPresupuesto('no_aprobado'), 'No aprobado');
    assert.equal(etiquetaEstadoPresupuesto('otro_estado'), 'otro_estado');
    assert.equal(etiquetaEstadoPresupuesto(null), 'Sin estado');
  });

  it('cada estado tiene su color y lo desconocido queda en gris', () => {
    assert.equal(tonoEstadoPresupuesto('pagado'), 'verde');
    assert.equal(tonoEstadoPresupuesto('cobrado'), 'ambar');
    assert.equal(tonoEstadoPresupuesto('no_aprobado'), 'rojo');
    assert.equal(tonoEstadoPresupuesto('enviado'), 'azul');
    assert.equal(tonoEstadoPresupuesto('raro'), 'gris');
  });
});

describe('resumen de presupuestos del cliente', () => {
  it('suma solo los aceptados y separa lo pagado de lo que falta por cobrar', () => {
    const r = resumenPresupuestosCliente(
      normalizarPresupuestosCliente([
        { id: 'a', subtotal: 1000.1, status: 'pagado', created_at: '2026-01-01T00:00:00Z' },
        { id: 'b', subtotal: '500.2', status: 'cobrado', created_at: '2026-02-01T00:00:00Z' },
        { id: 'c', subtotal: 300, status: 'enviado', created_at: null },
        { id: 'd', subtotal: 900, status: 'no_aprobado', created_at: null },
      ]),
    );
    assert.deepEqual(r, {
      cantidad: 4,
      aceptados: 2,
      montoAceptadoUsd: 1500.3,
      montoPagadoUsd: 1000.1,
      montoPorCobrarUsd: 500.2,
    });
  });

  it('sin presupuestos todo queda en cero', () => {
    assert.deepEqual(resumenPresupuestosCliente([]), {
      cantidad: 0,
      aceptados: 0,
      montoAceptadoUsd: 0,
      montoPagadoUsd: 0,
      montoPorCobrarUsd: 0,
    });
  });

  it('descarta filas sin identificador y tolera montos vacíos', () => {
    const filas = normalizarPresupuestosCliente([{ subtotal: 5 }, { id: 'x', subtotal: null, status: 'pagado' }, null]);
    assert.deepEqual(filas, [{ id: 'x', subtotal: 0, status: 'pagado', created_at: null }]);
    assert.deepEqual(normalizarPresupuestosCliente(null), []);
  });
});

describe('lecturas del cliente', () => {
  const tablas = () => ({
    budgets: [
      { id: 'b1', customer_id: CLIENTE, subtotal: 100, status: 'pagado', created_at: '2026-01-10T00:00:00Z' },
      { id: 'b2', customer_id: CLIENTE, subtotal: 200, status: 'enviado', created_at: '2026-03-10T00:00:00Z' },
      { id: 'b3', customer_id: OTRO, subtotal: 999, status: 'pagado', created_at: '2026-02-10T00:00:00Z' },
    ],
    ci_proyectos: [{ id: 'o1', customer_id: CLIENTE }],
  });

  it('trae solo los presupuestos de ese cliente, el más reciente primero', async () => {
    const r = await cargarPresupuestosCliente(base(tablas()), CLIENTE);
    assert.equal(r.error, null);
    assert.deepEqual(
      r.presupuestos.map((p) => p.id),
      ['b2', 'b1'],
    );
  });

  it('si la lectura falla lo dice en vez de mostrar una lista vacía sin aviso', async () => {
    const r = await cargarPresupuestosCliente(base(tablas(), ['budgets']), CLIENTE);
    assert.ok(r.error);
    assert.deepEqual(r.presupuestos, []);
  });

  it('cuenta los presupuestos y las obras del cliente', async () => {
    const r = await contarVinculosCliente(base(tablas()), CLIENTE);
    assert.deepEqual(r, { vinculos: { presupuestos: 2, obras: 1 }, error: null });
    const libre = await contarVinculosCliente(base(tablas()), '33333333-3333-4333-8333-333333333333');
    assert.deepEqual(libre.vinculos, { presupuestos: 0, obras: 0 });
  });

  it('si no puede contar devuelve el error (y entonces no se borra)', async () => {
    const r = await contarVinculosCliente(base(tablas(), ['budgets']), CLIENTE);
    assert.ok(r.error);
  });
});

describe('borrar un cliente', () => {
  it('se puede solo si no tiene presupuestos ni obras', () => {
    assert.equal(motivoNoBorrarCliente({ presupuestos: 0, obras: 0 }), null);
  });

  it('con presupuestos u obras explica por qué no', () => {
    assert.match(motivoNoBorrarCliente({ presupuestos: 1, obras: 0 }) ?? '', /1 presupuesto\./);
    assert.match(motivoNoBorrarCliente({ presupuestos: 3, obras: 2 }) ?? '', /3 presupuestos y 2 obras/);
    assert.match(motivoNoBorrarCliente({ presupuestos: 0, obras: 1 }) ?? '', /1 obra\./);
  });
});

describe('número para WhatsApp', () => {
  it('completa el código de Venezuela en los celulares locales', () => {
    assert.equal(numeroWhatsapp('0414-123 45 67'), '584141234567');
    assert.equal(numeroWhatsapp('4141234567'), '584141234567');
  });

  it('respeta los números que ya traen código de país', () => {
    assert.equal(numeroWhatsapp('+58 414 1234567'), '584141234567');
    assert.equal(numeroWhatsapp('0058 414 1234567'), '584141234567');
    assert.equal(numeroWhatsapp('+1 (305) 555-0100'), '13055550100');
  });

  it('sin número utilizable no ofrece el botón', () => {
    assert.equal(numeroWhatsapp(''), null);
    assert.equal(numeroWhatsapp(null), null);
    assert.equal(numeroWhatsapp('12345'), null);
  });
});
