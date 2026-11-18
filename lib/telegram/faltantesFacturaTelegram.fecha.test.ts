import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campoFaltanteFactura, parsearFechaEscrita } from './faltantesFacturaTelegram';

test('sin fecha extraída pide la fecha (después de número y total)', () => {
  assert.equal(campoFaltanteFactura({ invoice_number: '1', total_amount: 10, date: null } as never), 'fecha');
  assert.equal(campoFaltanteFactura({ invoice_number: '1', total_amount: 0, date: '2026-11-01' } as never), 'total');
  assert.equal(campoFaltanteFactura({ invoice_number: '1', total_amount: 10, date: '2026-11-01' } as never), null);
});

test('fecha inválida también se pide', () => {
  assert.equal(campoFaltanteFactura({ invoice_number: '1', total_amount: 10, date: '2026-02-30' } as never), 'fecha');
});

test('parsea formatos comunes', () => {
  assert.equal(parsearFechaEscrita('18/11/2026'), '2026-11-18');
  assert.equal(parsearFechaEscrita('5-3-2026'), '2026-03-05');
  assert.equal(parsearFechaEscrita('2026-11-18'), '2026-11-18');
  assert.equal(parsearFechaEscrita('31.02.2026'), null);
  assert.equal(parsearFechaEscrita('hola'), null);
});
