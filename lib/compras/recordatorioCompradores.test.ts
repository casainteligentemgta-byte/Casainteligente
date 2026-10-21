import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esHoraDeRecordatorio, ventanaCaracas } from './recordatorioCompradores';

// 2026-10-21 (miércoles). Caracas = UTC-4.
test('dentro de horario de oficina en Caracas (9,10,11,13,14,15)', () => {
  assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T13:00:00Z')), true); // 9:00
  assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T19:00:00Z')), true); // 15:00
});

test('fuera de horario: 12:00, 16:00 y 8:00 Caracas', () => {
  assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T16:00:00Z')), false); // 12:00
  assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T20:00:00Z')), false); // 16:00
  assert.equal(esHoraDeRecordatorio(new Date('2026-10-21T12:00:00Z')), false); // 8:00
});

test('fines de semana no recuerdan', () => {
  assert.equal(esHoraDeRecordatorio(new Date('2026-10-24T13:00:00Z')), false); // sábado 9:00
  assert.equal(esHoraDeRecordatorio(new Date('2026-10-25T13:00:00Z')), false); // domingo 9:00
});

test('ventanaCaracas devuelve hora y día correctos', () => {
  assert.deepEqual(ventanaCaracas(new Date('2026-10-21T13:00:00Z')), { hora: 9, diaSemana: 3 });
});
