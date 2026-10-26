import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { TelegramEstado } from './estados'
import {
  esCallbackCorreccion,
  esperandoCorreccionFactura,
  parsearFechaEscrita,
  valorCorregidoDesdeTexto,
} from './correccionFacturaTelegram'

function estado(partial: Partial<TelegramEstado>): TelegramEstado {
  return {
    chat_id: '1',
    contexto: 'factura',
    proyecto_id: null,
    pending_factura_id: 'pend-1',
    metadata: { paso: 'corregir_campo', campo: 'numero' },
    ...partial,
  } as TelegramEstado
}

describe('parsearFechaEscrita', () => {
  it('acepta DD/MM/AAAA y AAAA-MM-DD', () => {
    assert.equal(parsearFechaEscrita('15/03/2026'), '2026-03-15')
    assert.equal(parsearFechaEscrita('5-3-2026'), '2026-03-05')
    assert.equal(parsearFechaEscrita('2026-03-15'), '2026-03-15')
  })

  it('rechaza fechas que no existen o con otro formato', () => {
    assert.equal(parsearFechaEscrita('31/02/2026'), null)
    assert.equal(parsearFechaEscrita('2026/03/15'), null)
    assert.equal(parsearFechaEscrita('ayer'), null)
  })
})

describe('valorCorregidoDesdeTexto', () => {
  it('número: normaliza S/N y rechaza vacío', () => {
    assert.deepEqual(valorCorregidoDesdeTexto('numero', ' s/n '), { ok: true, valor: 'S/N' })
    assert.deepEqual(valorCorregidoDesdeTexto('numero', 'F-0042'), { ok: true, valor: 'F-0042' })
    assert.equal(valorCorregidoDesdeTexto('numero', '   ').ok, false)
  })

  it('RIF: pasa a mayúsculas', () => {
    assert.deepEqual(valorCorregidoDesdeTexto('rif', 'j-12345678-9'), { ok: true, valor: 'J-12345678-9' })
  })

  it('proveedor: exige al menos dos caracteres', () => {
    assert.equal(valorCorregidoDesdeTexto('proveedor', 'A').ok, false)
    assert.deepEqual(valorCorregidoDesdeTexto('proveedor', 'Procodima'), { ok: true, valor: 'Procodima' })
  })

  it('fecha: devuelve AAAA-MM-DD o un mensaje de error', () => {
    assert.deepEqual(valorCorregidoDesdeTexto('fecha', '15/03/2026'), { ok: true, valor: '2026-03-15' })
    assert.equal(valorCorregidoDesdeTexto('fecha', '31/02/2026').ok, false)
  })

  it('total: acepta formato venezolano y rechaza cero', () => {
    assert.deepEqual(valorCorregidoDesdeTexto('total', '1.250,50'), { ok: true, valor: 1250.5 })
    assert.equal(valorCorregidoDesdeTexto('total', '0').ok, false)
  })
})

describe('esCallbackCorreccion', () => {
  it('reconoce el prefijo cx: y no confunde otros', () => {
    assert.equal(esCallbackCorreccion('cx:abc:numero'), true)
    assert.equal(esCallbackCorreccion('cg:factura_ia'), false)
  })
})

describe('esperandoCorreccionFactura', () => {
  it('solo espera cuando hay paso de corrección y factura pendiente', () => {
    assert.equal(esperandoCorreccionFactura(estado({})), true)
    assert.equal(esperandoCorreccionFactura(estado({ pending_factura_id: null })), false)
    assert.equal(esperandoCorreccionFactura(estado({ metadata: { paso: 'dato_faltante' } })), false)
    assert.equal(esperandoCorreccionFactura(estado({ contexto: 'menu' })), false)
  })
})
