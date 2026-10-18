import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { medidaCompatible, medidasDe } from './medidasMaterial'
import { buscarEnCatalogoBase, type ItemCatalogoBase } from './catalogoBase'

describe('medidas en fracción', () => {
  it('distingue 1/2 de 1 1/2', () => {
    assert.deepEqual(Array.from(medidasDe('Ángulo 1 1/2" x 1/8"')), ['1y1de2', '1de8'])
    assert.deepEqual(Array.from(medidasDe('cabilla 1/2')), ['1de2'])
  })
  it('descarta materiales de otra medida y conserva los que no dicen medida', () => {
    assert.equal(medidaCompatible('cabilla 1/2', 'CABILLAS 3/8 X 12MTS'), false)
    assert.equal(medidaCompatible('cabilla 1/2', 'Cabilla 1/2" x 12 m'), true)
    assert.equal(medidaCompatible('cabilla 1/2', 'Cabilla corrugada'), true)
    assert.equal(medidaCompatible('cemento', 'Cabilla 3/8'), true)
  })
  it('el catálogo no confunde «1/2» con «1 1/2»', () => {
    const item = (id: string, nombre: string) =>
      ({ id, nombre, categoria: 'Acero y cabillas', categoria_orden: 1, orden: 1, unidad: 'UND', grupo: 'x', palabras_clave: '' }) as unknown as ItemCatalogoBase
    const items = [item('a', 'Cabilla 1/2" x 12 m'), item('b', 'Ángulo de hierro 1 1/2" x 1/8"'), item('c', 'Pletina 1 1/2" x 1/8"')]
    assert.deepEqual(buscarEnCatalogoBase(items, 'cabilla 1/2').map((i) => i.id), ['a'])
    assert.deepEqual(buscarEnCatalogoBase(items, 'angulo 1 1/2').map((i) => i.id), ['b'])
  })
})
