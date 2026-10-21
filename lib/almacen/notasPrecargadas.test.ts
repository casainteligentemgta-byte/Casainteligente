import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separarLineasPrecarga, type LineaPrecarga } from './notasPrecargadas';

const base = { unidad: 'UND', material_nombre: null, item_code: null } as const;

test('separa líneas con y sin material y descarta cantidades no positivas', () => {
  const lineas: LineaPrecarga[] = [
    { ...base, descripcion: 'Cemento', cantidad: 10, material_id: 'm1', material_nombre: 'Cemento gris' },
    { ...base, descripcion: 'Arena fina', cantidad: 2, material_id: null },
    { ...base, descripcion: 'Cero', cantidad: 0, material_id: 'm2' },
    { ...base, descripcion: 'Negativa', cantidad: -1, material_id: null },
  ];
  const r = separarLineasPrecarga(lineas);
  assert.deepEqual(r.conMaterial.map((l) => l.descripcion), ['Cemento']);
  assert.deepEqual(r.sinMaterial.map((l) => l.descripcion), ['Arena fina']);
});

test('material_id vacío cuenta como sin material', () => {
  const r = separarLineasPrecarga([{ ...base, descripcion: 'X', cantidad: 1, material_id: '  ' }]);
  assert.equal(r.conMaterial.length, 0);
  assert.equal(r.sinMaterial.length, 1);
});
