import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrarLineasOcrConCantidad,
  parsearCantidadesCompuestas,
  esUnidadEncabezadoColumna,
  RENGLONES_FORMULARIO_2M,
  type ItemOcrCrudo,
} from './filtrarLineasOcrIngreso';

function formulario2MSoloCemento(): ItemOcrCrudo[] {
  assert.equal(RENGLONES_FORMULARIO_2M.length, 13);
  return RENGLONES_FORMULARIO_2M.map((nombre) =>
    nombre === 'CEMENTO'
      ? {
          description: 'CEMENTO',
          item_code: '',
          unit: '',
          quantity: 4,
          unit_price: 0,
          quantity_present: true,
          quantity_raw: '4 pallet y 1/2 saco',
          quantity_parts: [
            { quantity: 4, unit: 'PALLET', label: '4 pallet' },
            { quantity: 0.5, unit: 'SACO', label: '1/2 saco' },
          ],
        }
      : {
          description: nombre,
          item_code: '',
          unit: 'M3',
          quantity: 0,
          unit_price: 0,
          quantity_present: false,
          quantity_raw: '',
        },
  );
}

describe('filtrarLineasOcrConCantidad', () => {
  it('formulario 2M de 13 renglones con solo cemento manuscrito produce 1 línea', () => {
    const filtradas = filtrarLineasOcrConCantidad(formulario2MSoloCemento());
    assert.equal(filtradas.length, 1);
    assert.match(filtradas[0].description, /cemento/i);
    assert.equal(filtradas[0].cantidad, 4);
    assert.equal(filtradas[0].cantidades.length, 2);
    assert.equal(filtradas[0].cantidades[0].cantidad, 4);
    assert.equal(filtradas[0].cantidades[1].cantidad, 0.5);
  });

  it('no inventa cantidad 1 en renglones vacíos ni usa el encabezado M3 como cantidad', () => {
    const filtradas = filtrarLineasOcrConCantidad([
      { description: 'BLOQUES', unit: 'M3', quantity: 0, quantity_present: false },
      { description: 'POLVILLO', unit: 'M3' },
    ]);
    assert.equal(filtradas.length, 0);
  });
});

describe('parsearCantidadesCompuestas', () => {
  it('lee 4 pallet y 1/2 saco como dos cantidades', () => {
    const partes = parsearCantidadesCompuestas('4 pallet y 1/2 saco');
    assert.equal(partes.length, 2);
    assert.equal(partes[0].cantidad, 4);
    assert.match(partes[0].unidad, /PALLET/i);
    assert.equal(partes[1].cantidad, 0.5);
    assert.match(partes[1].unidad, /SACO/i);
  });
});

describe('esUnidadEncabezadoColumna', () => {
  it('detecta encabezados vacíos o de columna, no unidades reales', () => {
    assert.equal(esUnidadEncabezadoColumna(''), true);
    assert.equal(esUnidadEncabezadoColumna('CANTIDAD'), true);
    assert.equal(esUnidadEncabezadoColumna('UNIDAD'), true);
    assert.equal(esUnidadEncabezadoColumna('SACO'), false);
    assert.equal(esUnidadEncabezadoColumna('PALLET'), false);
  });
});
