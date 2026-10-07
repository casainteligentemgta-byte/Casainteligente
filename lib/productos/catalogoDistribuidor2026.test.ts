import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  claveCatalogo,
  payloadCatalogoDistribuidor,
  planearCargaCatalogo,
  type ItemCatalogoDistribuidor,
} from './catalogoDistribuidor2026'

const item = (modelo: string, marca = 'Hikvision', costo = 15): ItemCatalogoDistribuidor => ({
  marca,
  modelo,
  nombre: `${marca} ${modelo}`,
  categoria: 'Domótica',
  costo,
  estatus: 'DISPONIBLE',
  descripcion: 'Prueba',
})

test('claveCatalogo ignora mayúsculas y espacios', () => {
  assert.equal(claveCatalogo(' Hikvision ', 'DS-K2210'), claveCatalogo('hikvision', 'ds-k2210'))
})

test('payload: precio = costo y utilidad 0; no inventa margen ni updated_at', () => {
  const p = payloadCatalogoDistribuidor(item('DS-K2210', 'Hikvision', 270))
  assert.equal(p.costo, 270)
  assert.equal(p.precio, 270)
  assert.equal(p.utilidad, 0)
  assert.equal('updated_at' in p, false)
  assert.equal('modificado' in p, false)
})

test('plan: SKU nuevo se crea; mismo marca+modelo se actualiza', () => {
  const plan = planearCargaCatalogo(
    [item('DS-K2210'), item('UVC-G4', 'Ubiquiti', 575)],
    [{ id: 9, marca: 'Hikvision', modelo: 'DS-K2210' }],
  )
  assert.equal(plan.actualizar.length, 1)
  assert.equal(plan.actualizar[0]!.id, 9)
  assert.equal(plan.crear.length, 1)
  assert.equal(plan.crear[0]!.modelo, 'UVC-G4')
})

test('plan: modelo con marca vacía se empareja, otra marca no', () => {
  const plan = planearCargaCatalogo(
    [item('DS-K2210'), item('DS-K2210', 'Otra')],
    [{ id: 3, marca: null, modelo: 'DS-K2210' }],
  )
  assert.equal(plan.actualizar.length, 1)
  assert.equal(plan.actualizar[0]!.item.marca, 'Hikvision')
  assert.equal(plan.crear.length, 1)
  assert.equal(plan.crear[0]!.marca, 'Otra')
})
