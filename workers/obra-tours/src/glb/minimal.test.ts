import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildObraGlb, buildObraMesh } from './minimal.js';

test('buildObraMesh genera geometría válida', () => {
  const mesh = buildObraMesh({ bloques: 5, span: 12, fuente: 'dron' });
  assert.ok(mesh.positions.length >= 12);
  assert.equal(mesh.positions.length % 3, 0);
  assert.equal(mesh.colors.length, mesh.positions.length);
  assert.ok(mesh.indices.length >= 6);
});

test('buildObraGlb produce magic glTF', () => {
  const glb = buildObraGlb({ bloques: 4, span: 10, fuente: 'celular' });
  assert.ok(glb.length > 100);
  assert.equal(glb.readUInt32LE(0), 0x46546c67);
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
});
