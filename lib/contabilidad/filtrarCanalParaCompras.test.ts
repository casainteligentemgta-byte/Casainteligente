import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarPendientesCanalParaCompras } from './filtrarCanalParaCompras';

const filas = [
  { id: 'a', entidad_id: 'dima', proyecto_id: 'flam', created_at: '2026-11-18T10:00:00Z', extracted: { date: '2026-10-20', supplier_name: 'X' } },
  { id: 'b', entidad_id: 'dima', proyecto_id: null, created_at: '2026-11-17T10:00:00Z', extracted: { date: null, supplier_name: 'Y' } },
  { id: 'c', entidad_id: 'otra', proyecto_id: 'flam', created_at: '2026-11-16T10:00:00Z', extracted: { date: '2026-11-01', supplier_name: 'X' } },
  { id: 'd', entidad_id: null, proyecto_id: null, created_at: '2026-11-15T10:00:00Z', extracted: null },
];
const ids = (r: { id: string }[]) => r.map((x) => x.id);

test('sin filtros devuelve todo', () => {
  assert.deepEqual(ids(filtrarPendientesCanalParaCompras(filas, {})), ['a', 'b', 'c', 'd']);
});

test('filtra por entidad', () => {
  assert.deepEqual(ids(filtrarPendientesCanalParaCompras(filas, { entidadId: 'dima' })), ['a', 'b']);
});

test('entidad y obra juntas', () => {
  assert.deepEqual(
    ids(filtrarPendientesCanalParaCompras(filas, { entidadId: 'dima', proyectoId: 'flam' })),
    ['a'],
  );
});

test('sin_entidad y sin_proyecto', () => {
  assert.deepEqual(ids(filtrarPendientesCanalParaCompras(filas, { entidadId: 'sin_entidad' })), ['d']);
  assert.deepEqual(ids(filtrarPendientesCanalParaCompras(filas, { proyectoId: 'sin_proyecto' })), ['b', 'd']);
});

test('rango usa la fecha de la factura, no la de carga', () => {
  // 'a' tiene fecha de factura 2026-10-20 aunque se cargó el 18-nov.
  assert.deepEqual(
    ids(filtrarPendientesCanalParaCompras(filas, { desde: '2026-10-01', hasta: '2026-10-31' })),
    ['a'],
  );
});

test('proveedor exacto', () => {
  assert.deepEqual(ids(filtrarPendientesCanalParaCompras(filas, { proveedor: 'X' })), ['a', 'c']);
});
