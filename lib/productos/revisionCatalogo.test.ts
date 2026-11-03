import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  avisoEliminarProducto,
  contarPorCorregir,
  filtrarPorCorregir,
  idsDeNombresRepetidos,
  productoSinCategoria,
  productoSinPrecio,
  terminoBusquedaCatalogo,
} from './revisionCatalogo';

const productos = [
  { id: 1, nombre: 'Cámara Domo 2MP', categoria: 'Cámaras IP', precio: 50, costo: 40, imagen: 'https://a' },
  { id: 2, nombre: 'camara domo 2mp ', categoria: 'Cámaras IP', precio: 55, costo: 40, imagen: null },
  { id: 3, nombre: 'Tubo conduit', categoria: '', precio: 0, costo: 8, imagen: null },
  { id: 4, nombre: 'Andamios', categoria: null, precio: null, costo: null, imagen: null },
  { id: 5, nombre: 'Switch 8 puertos', categoria: 'Network', precio: 120, costo: 120, imagen: 'https://b' },
  { id: 6, nombre: 'CÁMARA  DOMO 2MP', categoria: ' ', precio: 60, costo: 60, image_url: 'https://c' },
];

describe('productos por corregir', () => {
  it('sin precio: vacío, cero o negativo', () => {
    assert.equal(productoSinPrecio({ id: 1, precio: null }), true);
    assert.equal(productoSinPrecio({ id: 1, precio: 0 }), true);
    assert.equal(productoSinPrecio({ id: 1, precio: -3 }), true);
    assert.equal(productoSinPrecio({ id: 1, precio: 0.01 }), false);
  });

  it('sin categoría: vacía o solo espacios', () => {
    assert.equal(productoSinCategoria({ id: 1, categoria: null }), true);
    assert.equal(productoSinCategoria({ id: 1, categoria: '  ' }), true);
    assert.equal(productoSinCategoria({ id: 1, categoria: 'Network' }), false);
  });

  it('repetidos: mismo nombre sin distinguir acentos, mayúsculas ni espacios', () => {
    assert.deepEqual([...idsDeNombresRepetidos(productos)].sort(), [1, 2, 6]);
  });

  it('cuenta cada grupo', () => {
    assert.deepEqual(contarPorCorregir(productos), {
      sin_precio: 2,
      sin_margen: 3,
      sin_foto: 3,
      sin_categoria: 3,
      repetidos: 3,
    });
  });

  it('filtra cada grupo y deja juntas las copias', () => {
    assert.deepEqual(filtrarPorCorregir(productos, 'sin_precio').map((p) => p.id), [3, 4]);
    assert.deepEqual(filtrarPorCorregir(productos, 'sin_margen').map((p) => p.id), [3, 5, 6]);
    assert.deepEqual(filtrarPorCorregir(productos, 'sin_foto').map((p) => p.id), [2, 3, 4]);
    assert.deepEqual(filtrarPorCorregir(productos, 'sin_categoria').map((p) => p.id), [3, 4, 6]);
    assert.deepEqual(filtrarPorCorregir(productos, 'repetidos').map((p) => p.id), [1, 2, 6]);
    assert.equal(filtrarPorCorregir(productos, '').length, productos.length);
  });
});

describe('búsqueda en el catálogo', () => {
  it('quita los signos que rompían la consulta', () => {
    assert.equal(terminoBusquedaCatalogo('cable 2x18, rojo'), 'cable 2x18 rojo');
    assert.equal(terminoBusquedaCatalogo('tubo (1/2")'), 'tubo 1/2');
    assert.equal(terminoBusquedaCatalogo('  100% * cobre  '), '100 cobre');
  });

  it('deja igual una búsqueda normal', () => {
    assert.equal(terminoBusquedaCatalogo('Cámara IP 4MP'), 'Cámara IP 4MP');
    assert.equal(terminoBusquedaCatalogo('DS-2CD1023G0E-I'), 'DS-2CD1023G0E-I');
  });
});

describe('aviso antes de eliminar un producto', () => {
  it('sin uso no pregunta nada más', () => {
    assert.equal(avisoEliminarProducto('Cable', { presupuestos: 0, almacen: 0 }), null);
  });

  it('en presupuestos: avisa y aclara que los guardados no cambian', () => {
    const t = avisoEliminarProducto('Cable', { presupuestos: 3, almacen: 0 }) ?? '';
    assert.match(t, /«Cable» está en 3 presupuestos/);
    assert.match(t, /no cambian/);
    assert.match(avisoEliminarProducto('Cable', { presupuestos: 1, almacen: 0 }) ?? '', /en 1 presupuesto \(/);
  });

  it('con artículos de almacén enlazados también avisa', () => {
    const t = avisoEliminarProducto('Cable', { presupuestos: 1, almacen: 2 }) ?? '';
    assert.match(t, /1 presupuesto .* y tiene 2 artículos de almacén enlazados/);
  });
});
