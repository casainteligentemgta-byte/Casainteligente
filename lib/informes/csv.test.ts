import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escaparCeldaCsv, filasACsv } from './csv';

describe('csv informes', () => {
  it('escapa comillas y comas', () => {
    assert.equal(escaparCeldaCsv('a,b'), '"a,b"');
    assert.equal(escaparCeldaCsv('diyo "x"'), '"diyo ""x"""');
  });

  it('arma CSV con BOM', () => {
    const csv = filasACsv(['A', 'B'], [[1, 'hola']]);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes('A,B'));
    assert.ok(csv.includes('1,hola'));
  });
});
