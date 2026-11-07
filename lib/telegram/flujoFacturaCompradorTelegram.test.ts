import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { siguientePasoFlujoFacturaComprador } from './flujoFacturaCompradorTelegram'

describe('siguientePasoFlujoFacturaComprador', () => {
  it('pide moneda aunque el perfil la haya sugerido', () => {
    const paso = siguientePasoFlujoFacturaComprador({
        invoice_number: 'F-1',
        total_amount: 10,
        moneda: 'USD',
        campos_sugeridos: ['moneda'],
    })
    assert.equal(paso, 'moneda')
  })

  it('sigue a destino cuando moneda y pago ya no son sugeridos', () => {
    const paso = siguientePasoFlujoFacturaComprador(
      {
        invoice_number: 'F-1',
        total_amount: 10,
        moneda: 'USD',
        condicion_pago: 'contado',
        campos_sugeridos: ['proyecto_id'],
      },
      { proyecto_id: null, ubicacion_destino_id: null },
    )
    assert.equal(paso, 'destino')
  })
})
