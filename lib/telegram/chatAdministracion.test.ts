import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { elegirChatAdministracion } from './chatAdministracion'

describe('a quién van los avisos de administración', () => {
  it('primero el chat configurado, luego el canal de administración, al final el del administrador', () => {
    assert.deepEqual(
      elegirChatAdministracion({ chatCeo: ' 111 ', canalAdmin: '-100222', chatAdministrador: '333' }),
      { chatId: '111', fuente: 'TELEGRAM_CHAT_ID' },
    )
    assert.deepEqual(elegirChatAdministracion({ chatCeo: '', canalAdmin: ' -100222 ', chatAdministrador: '333' }), {
      chatId: '-100222',
      fuente: 'canal de administración',
    })
    assert.deepEqual(elegirChatAdministracion({ chatCeo: null, canalAdmin: '   ', chatAdministrador: '333' }), {
      chatId: '333',
      fuente: 'chat del administrador',
    })
  })

  it('sin ninguno configurado no inventa destino', () => {
    assert.deepEqual(elegirChatAdministracion({}), { chatId: null, fuente: null })
    assert.deepEqual(elegirChatAdministracion({ chatCeo: ' ', canalAdmin: null, chatAdministrador: undefined }), {
      chatId: null,
      fuente: null,
    })
  })
})
