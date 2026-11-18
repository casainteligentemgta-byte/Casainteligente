import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractedCoincideSinNumero } from './buscarCompraContablePorFactura'

const base = {
  date: '2026-11-18',
  total_amount: 224.6,
  supplier_rif: 'J-30657433-6',
  supplier_name: 'LA TIENDA DEL PINTOR PAMPATAR. C.A.',
  invoice_number: '',
}
const params = {
  invoice_number: '',
  supplier_rif: 'J-30657433-6',
  supplier_name: 'LA TIENDA DEL PINTOR PAMPATAR, C.A',
  fecha: '2026-11-18',
  total: 224.6,
}

describe('extractedCoincideSinNumero', () => {
  it('nota sin número con mismo proveedor, fecha y total es duplicada', () => {
    assert.equal(extractedCoincideSinNumero(base, params), true)
  })
  it('otra fecha no es duplicada', () => {
    assert.equal(extractedCoincideSinNumero({ ...base, date: '2026-11-17' }, params), false)
  })
  it('otro total no es duplicado', () => {
    assert.equal(extractedCoincideSinNumero({ ...base, total_amount: 230 }, params), false)
  })
  it('otro proveedor no es duplicado', () => {
    assert.equal(extractedCoincideSinNumero({ ...base, supplier_rif: 'J-99999999-9', supplier_name: 'OTRO' }, params), false)
  })
  it('si alguna tiene número, no aplica esta regla', () => {
    assert.equal(extractedCoincideSinNumero({ ...base, invoice_number: '00000183' }, params), false)
    assert.equal(extractedCoincideSinNumero(base, { ...params, invoice_number: '00000183' }), false)
  })
})
