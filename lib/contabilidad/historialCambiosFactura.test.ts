import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FacturaDuplicadaError, MENSAJE_FACTURA_DUPLICADA } from '../canal/facturaDuplicada'
import { cambiosEntreFacturas } from './historialCambiosFactura'

describe('cambiosEntreFacturas', () => {
  it('devuelve solo los campos que cambiaron', () => {
    const prev = { invoice_number: 'F-1', supplier_rif: 'J-1', total_amount: 100 }
    const next = { invoice_number: 'F-2', supplier_rif: 'J-1', total_amount: 100 }
    assert.deepEqual(cambiosEntreFacturas(prev, next), [
      { campo: 'invoice_number', anterior: 'F-1', nuevo: 'F-2' },
    ])
  })

  it('no cuenta como cambio 1250 frente a "1250.00"', () => {
    assert.deepEqual(cambiosEntreFacturas({ total_amount: 1250 }, { total_amount: '1250.00' }, ['total_amount']), [])
  })

  it('ignora espacios y nulos vacíos', () => {
    assert.deepEqual(cambiosEntreFacturas({ supplier_name: null }, { supplier_name: '  ' }, ['supplier_name']), [])
  })

  it('registra el paso de vacío a un valor', () => {
    assert.deepEqual(cambiosEntreFacturas({ date: null }, { date: '2026-03-15' }, ['date']), [
      { campo: 'date', anterior: null, nuevo: '2026-03-15' },
    ])
  })

  it('no mira campos que no vienen en la nueva versión', () => {
    assert.deepEqual(cambiosEntreFacturas({ invoice_number: 'A' }, {}, ['invoice_number']), [])
  })
})

describe('FacturaDuplicadaError', () => {
  it('lleva el mensaje de factura duplicada', () => {
    const err = new FacturaDuplicadaError()
    assert.equal(err.message, MENSAJE_FACTURA_DUPLICADA)
    assert.ok(err instanceof Error)
  })
})
