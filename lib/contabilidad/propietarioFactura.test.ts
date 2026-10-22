import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compararReceptorConPropietario, normalizarNombreEmpresa } from './propietarioFactura';

describe('normalizarNombreEmpresa', () => {
  it('ignora sufijos, acentos y puntuación', () => {
    assert.equal(normalizarNombreEmpresa('Inversiones Neroca 78 Mil, C.A.'), 'inversiones neroca 78 mil');
    assert.equal(normalizarNombreEmpresa('INVERSIONES NEROCA 78 MIL C A'), 'inversiones neroca 78 mil');
  });
});

describe('compararReceptorConPropietario', () => {
  const propietario = { nombre: 'Inversiones Neroca 78 Mil, C.A.', rif: 'J-295705697' };

  it('coincide por RIF aunque el nombre esté escrito distinto', () => {
    const r = compararReceptorConPropietario({ nombre: 'Neroca', rif: 'J295705697' }, propietario);
    assert.deepEqual(r, { estado: 'coincide' });
  });

  it('avisa si el RIF es de otra empresa', () => {
    const r = compararReceptorConPropietario({ nombre: 'Procodima, C.A.', rif: 'J-294752721' }, propietario);
    assert.equal(r.estado, 'no_coincide');
    assert.equal(r.estado === 'no_coincide' && r.motivo, 'rif');
  });

  it('sin RIF compara nombres y detecta 28 vs 78', () => {
    const r = compararReceptorConPropietario(
      { nombre: 'Inversiones Neroca 28 Mil, C.A.' },
      { nombre: 'Inversiones Neroca 78 Mil, C.A.', rif: null },
    );
    assert.equal(r.estado, 'no_coincide');
  });

  it('no avisa si no hay datos del receptor', () => {
    assert.deepEqual(compararReceptorConPropietario({}, propietario), { estado: 'sin_datos' });
  });
});
