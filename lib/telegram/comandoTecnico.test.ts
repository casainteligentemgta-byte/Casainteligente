import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { procesarComandoTelegram } from '@/lib/telegram/commands'
import { TELEGRAM_BOT_COMMANDS, MENSAJE_MENU_TELEGRAM, MENSAJE_AYUDA_TELEGRAM } from '@/lib/telegram/botCommands'
describe('comando /tecnico', () => {
  it('se reconoce con y sin pregunta', () => {
    assert.deepEqual(procesarComandoTelegram('/tecnico ¿cuántos W consume la H9c?'), { handled: true, comandoTecnico: true, tecnicoPregunta: '¿cuántos W consume la H9c?' })
    assert.deepEqual(procesarComandoTelegram('/tecnico'), { handled: true, comandoTecnico: true, tecnicoPregunta: '' })
    assert.equal(procesarComandoTelegram('/Tecnico@Bot hola equipo').tecnicoPregunta, 'hola equipo')
    assert.equal(procesarComandoTelegram('/stock cemento').comandoTecnico, undefined)
  })
  it('aparece en el menú', () => {
    assert.ok(TELEGRAM_BOT_COMMANDS.some((c) => c.command === 'tecnico'))
    assert.match(MENSAJE_MENU_TELEGRAM, /\/tecnico/)
    assert.match(MENSAJE_AYUDA_TELEGRAM, /\/tecnico/)
    for (const c of TELEGRAM_BOT_COMMANDS) assert.ok(c.description.length <= 256 && /^[a-z0-9_]{1,32}$/.test(c.command), c.command)
  })
})
