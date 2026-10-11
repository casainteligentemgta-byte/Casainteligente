import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATEGORIAS_CATALOGO_DEFAULT,
  categoriaExistenteEquivalente,
  categoriasAMostrar,
  claveNombreCategoria,
  mergeNombresCategoria,
} from './categoriasCatalogo';

describe('categorías del catálogo', () => {
  it('«Domotica» y «Domótica» son la misma', () => {
    assert.equal(claveNombreCategoria('Domótica'), claveNombreCategoria(' domotica '));
    assert.equal(claveNombreCategoria('Cercos  Eléctricos'), claveNombreCategoria('CERCOS ELECTRICOS'));
    assert.notEqual(claveNombreCategoria('Cámaras IP'), claveNombreCategoria('Cámaras Análogas'));
  });

  it('al unir listas queda una sola, la que venía primero (la de base, con acento)', () => {
    const lista = mergeNombresCategoria(CATEGORIAS_CATALOGO_DEFAULT, ['Domotica', 'Cercos Electricos', 'Opción 3']);
    assert.equal(lista.filter((n) => claveNombreCategoria(n) === 'domotica').length, 1);
    assert.ok(lista.includes('Domótica'));
    assert.ok(!lista.includes('Domotica'));
    assert.ok(!lista.includes('Cercos Electricos'));
    assert.ok(lista.includes('Opción 3'));
  });

  it('reconoce una categoría que ya existe con otro acento o mayúsculas', () => {
    assert.equal(categoriaExistenteEquivalente('camaras analogas', CATEGORIAS_CATALOGO_DEFAULT), 'Cámaras Análogas');
    assert.equal(categoriaExistenteEquivalente('Iluminación', CATEGORIAS_CATALOGO_DEFAULT), null);
    assert.equal(categoriaExistenteEquivalente('  ', CATEGORIAS_CATALOGO_DEFAULT), null);
  });

  it('con la tabla disponible, lo guardado en un navegador no revive categorías borradas', () => {
    const lista = categoriasAMostrar(['Cámaras IP', 'Iluminación'], [], ['Opción 3']);
    assert.ok(lista.includes('Iluminación'));
    assert.ok(!lista.includes('Opción 3'));
  });

  it('si la tabla no responde, se usa lo que haya: productos y memoria local', () => {
    const lista = categoriasAMostrar(null, ['Audio'], ['Opción 3']);
    assert.ok(lista.includes('Audio'));
    assert.ok(lista.includes('Opción 3'));
    assert.ok(lista.includes('Domótica'));
  });
});
