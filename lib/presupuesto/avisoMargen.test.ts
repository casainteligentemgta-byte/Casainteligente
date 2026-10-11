import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { avisoGuardarSinGanancia, renglonesAlCostoOBajo } from './avisoMargen'

describe('renglones al costo o por debajo', () => {
  it('con ganancia no se marca', () => {
    assert.deepEqual(renglonesAlCostoOBajo([{ nombre: 'Cámara', cantidad: 2, precioUnitario: 60, costo: 50 }]), [])
  })

  it('al costo exacto se marca, sin pérdida', () => {
    assert.deepEqual(renglonesAlCostoOBajo([{ nombre: 'Switch', cantidad: 3, precioUnitario: 80, costo: 80 }]), [
      { nombre: 'Switch', vendido: 80, costo: 80, perdida: 0 },
    ])
  })

  it('por debajo del costo: la pérdida es por todas las unidades', () => {
    assert.deepEqual(renglonesAlCostoOBajo([{ nombre: 'Herrería', cantidad: 2, precioUnitario: 1500, costo: 4000 }]), [
      { nombre: 'Herrería', vendido: 1500, costo: 4000, perdida: 5000 },
    ])
  })

  it('el descuento cuenta: un precio con ganancia puede quedar bajo el costo', () => {
    const r = renglonesAlCostoOBajo([{ nombre: 'Cable', cantidad: 1, precioUnitario: 100, descuentoPct: 25, costo: 80 }])
    assert.deepEqual(r, [{ nombre: 'Cable', vendido: 75, costo: 80, perdida: 5 }])
  })

  it('sin costo en el catálogo no se opina', () => {
    assert.deepEqual(
      renglonesAlCostoOBajo([
        { nombre: 'Sin costo', cantidad: 1, precioUnitario: 10, costo: null },
        { nombre: 'Costo cero', cantidad: 1, precioUnitario: 0, costo: 0 },
      ]),
      [],
    )
  })

  it('un céntimo de redondeo no es ganancia', () => {
    assert.equal(renglonesAlCostoOBajo([{ nombre: 'Barra', cantidad: 1, precioUnitario: 74.34, costo: 74.34 }]).length, 1)
    assert.equal(renglonesAlCostoOBajo([{ nombre: 'Barra', cantidad: 1, precioUnitario: 74.36, costo: 74.34 }]).length, 0)
  })
})

describe('aviso al guardar el presupuesto', () => {
  it('si todo deja ganancia no pregunta nada', () => {
    assert.equal(avisoGuardarSinGanancia([{ nombre: 'Cámara', cantidad: 1, precioUnitario: 60, costo: 50 }]), null)
    assert.equal(avisoGuardarSinGanancia([]), null)
  })

  it('un renglón al costo: lo nombra y dice que no deja ganancia', () => {
    const t = avisoGuardarSinGanancia([
      { nombre: 'Cámara', cantidad: 1, precioUnitario: 60, costo: 50 },
      { nombre: 'Switch 8 puertos', cantidad: 1, precioUnitario: 80, costo: 80 },
    ])
    assert.equal(
      t,
      'Un renglón se vende al costo o por debajo:\n\n• Switch 8 puertos: vendes al costo ($80.00)\n\nEn esos renglones el presupuesto no deja ganancia. Puedes subir el margen o corregir el precio.\n\n¿Guardar de todos modos?',
    )
  })

  it('por debajo del costo: dice cuánto se pierde', () => {
    const t = avisoGuardarSinGanancia([
      { nombre: 'Mano de obra', cantidad: 1, precioUnitario: 2000, costo: 4000 },
      { nombre: 'Tubo', cantidad: 10, precioUnitario: 5, costo: 5 },
    ]) ?? ''
    assert.match(t, /^2 renglones se venden al costo o por debajo:/)
    assert.match(t, /• Mano de obra: vendes a \$2,000\.00 y cuesta \$4,000\.00/)
    assert.match(t, /• Tubo: vendes al costo \(\$5\.00\)/)
    assert.match(t, /el presupuesto pierde \$2,000\.00\./)
  })

  it('con muchos renglones lista cinco y resume el resto', () => {
    const renglones = Array.from({ length: 8 }, (_, i) => ({ nombre: `Producto ${i + 1}`, cantidad: 1, precioUnitario: 10, costo: 10 }))
    const t = avisoGuardarSinGanancia(renglones) ?? ''
    assert.match(t, /^8 renglones/)
    assert.match(t, /• Producto 5:/)
    assert.doesNotMatch(t, /• Producto 6:/)
    assert.match(t, /• …y 3 más/)
  })

  it('recorta los nombres muy largos', () => {
    const t = avisoGuardarSinGanancia([{ nombre: 'X'.repeat(80), cantidad: 1, precioUnitario: 1, costo: 1 }]) ?? ''
    assert.match(t, /• X{45}…: vendes al costo/)
  })
})
