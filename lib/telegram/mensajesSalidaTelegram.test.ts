import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { procesarComandoTelegram } from './commands'
import { TELEGRAM_BOT_COMMANDS, MENSAJE_MENU_TELEGRAM } from './botCommands'
import {
  MENU_SALIDA_TEXTO,
  MENSAJE_INICIO_SALIDA_OBRA,
  MENSAJE_INICIO_SALIDA_DESPACHO,
  MENSAJE_INICIO_SALIDA_TRASPASO,
} from './mensajesSalidaTelegram'

describe('menú /salida unificado', () => {
  it('abre el menú y no un flujo suelto', () => {
    assert.deepEqual(procesarComandoTelegram('/salida'), {
      handled: true,
      comandoMenuSalida: true,
    })
    assert.equal(procesarComandoTelegram('/egreso').comandoSalida, true)
  })

  it('describe los tres tipos y apunta a /salida', () => {
    assert.match(MENU_SALIDA_TEXTO, /obrero en obra/)
    assert.match(MENU_SALIDA_TEXTO, /Despacho/)
    assert.match(MENU_SALIDA_TEXTO, /Traspaso/)
    assert.match(MENSAJE_INICIO_SALIDA_OBRA, /\/salida/)
    assert.match(MENSAJE_INICIO_SALIDA_DESPACHO, /\/salida/)
    assert.match(MENSAJE_INICIO_SALIDA_TRASPASO, /\/salida/)
    assert.doesNotMatch(MENSAJE_INICIO_SALIDA_DESPACHO, /\/salidaalmacen/)
    assert.doesNotMatch(MENSAJE_INICIO_SALIDA_TRASPASO, /\/traspaso/)
  })

  it('el menú nativo menciona despacho y traspaso', () => {
    assert.ok(TELEGRAM_BOT_COMMANDS.some((c) => c.command === 'salida'))
    assert.match(MENSAJE_MENU_TELEGRAM, /despacho/)
  })
})
