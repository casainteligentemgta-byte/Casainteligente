import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  filtrarPresupuestosVentas,
  puntajePresupuestoVentas,
  resolverPresupuestoVentas,
  type ResumenPresupuestoVentas,
} from '@/lib/netvision/elegirPresupuestoVentas'

const fila = (
  extra: Partial<ResumenPresupuestoVentas> & Pick<ResumenPresupuestoVentas, 'id' | 'cliente' | 'subtotal'>,
): ResumenPresupuestoVentas => ({
  notas: '',
  fecha: '2026-10-08T12:00:00.000Z',
  items: [{ qty: 1 }],
  ...extra,
})

describe('elegir presupuesto de Ventas para la vista cliente', () => {
  it('si el proyecto es de Indira, toma el suyo y no el de otro cliente', () => {
    const indira = fila({ id: 'b-indira', cliente: 'Indira Pérez', subtotal: 6120 })
    const otro = fila({ id: 'b-otro', cliente: 'Casa López', subtotal: 8000, fecha: '2026-10-09T12:00:00.000Z' })
    const r = resolverPresupuestoVentas([otro, indira], {
      nombreProyecto: 'Proyecto CCS',
      nombreCliente: 'Indira',
    })
    assert.equal(r.tipo, 'unico')
    if (r.tipo === 'unico') {
      assert.equal(r.fila.id, 'b-indira')
      assert.equal(r.fila.subtotal, 6120)
    }
  })

  it('sin cliente en el plano no adivina: lista el de Indira arriba por monto', () => {
    const indira = fila({ id: 'b-indira', cliente: 'Indira', subtotal: 6120 })
    const chico = fila({ id: 'b-chico', cliente: 'Otro', subtotal: 200 })
    const r = resolverPresupuestoVentas([chico, indira], { nombreProyecto: 'Proyecto CCS' })
    assert.equal(r.tipo, 'varios')
    if (r.tipo === 'varios') {
      assert.equal(r.filas[0]!.id, 'b-indira')
      assert.equal(r.filas[0]!.subtotal, 6120)
    }
  })

  it('la nota de NetVision del mismo proyecto gana', () => {
    const dePlano = fila({
      id: 'b-nv',
      cliente: 'CCS',
      subtotal: 5400,
      notas: 'Generado desde NetVision: Proyecto CCS.',
    })
    const indira = fila({ id: 'b-indira', cliente: 'Indira', subtotal: 6120 })
    const r = resolverPresupuestoVentas([indira, dePlano], { nombreProyecto: 'Proyecto CCS' })
    assert.equal(r.tipo, 'unico')
    if (r.tipo === 'unico') assert.equal(r.fila.id, 'b-nv')
  })

  it('buscar «indira» deja solo el suyo', () => {
    const lista = filtrarPresupuestosVentas(
      [
        fila({ id: 'b-indira', cliente: 'Indira Pérez', subtotal: 6120 }),
        fila({ id: 'b-otro', cliente: 'Casa López', subtotal: 800 }),
      ],
      'Indira',
    )
    assert.equal(lista.length, 1)
    assert.equal(lista[0]!.id, 'b-indira')
  })

  it('el nombre Indira puntúa más que un presupuesto ajeno más caro', () => {
    const indira = puntajePresupuestoVentas(
      { cliente: 'Indira Pérez', notas: '' },
      { nombreProyecto: 'Proyecto CCS', nombreCliente: 'Indira' },
    )
    const otro = puntajePresupuestoVentas(
      { cliente: 'Casa López', notas: '' },
      { nombreProyecto: 'Proyecto CCS', nombreCliente: 'Indira' },
    )
    assert.ok(indira >= 8)
    assert.ok(indira > otro)
  })
})
