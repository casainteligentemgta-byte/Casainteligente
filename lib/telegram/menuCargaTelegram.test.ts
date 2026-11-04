import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  botonesDe,
  capturarTelegram,
  crearFakeSupabase,
} from '@/lib/telegram/testing/fakeSupabase'
import {
  enviarMenuIngreso,
  manejarCallbackCarga,
} from '@/lib/telegram/menuCargaTelegram'
import { MENSAJE_CARGA_FACTURA_NO_DEPOSITARIO } from '@/lib/telegram/permisosAlmacenTelegram'

describe('menú /ingreso unificado (cg:)', () => {
  let telegram: ReturnType<typeof capturarTelegram>

  beforeEach(() => {
    telegram = capturarTelegram()
  })
  afterEach(() => {
    telegram.restaurar()
  })

  it('muestra un solo menú con botones claros', async () => {
    const db = crearFakeSupabase()
    await enviarMenuIngreso(db as unknown as SupabaseClient, '900')
    const ultimo = telegram.enviados.at(-1)
    assert.match(String(ultimo?.text), /Ingreso a almacén/)
    const textos = botonesDe(ultimo)
    assert.deepEqual(textos, [
      '📥 Facturas del comprador',
      '📄 Nota de entrega',
      '🧾 Factura en mano',
      '📝 Sin nota',
    ])
    const callbacks = (ultimo?.reply_markup?.inline_keyboard ?? [])
      .flat()
      .map((b) => b.callback_data)
    assert.deepEqual(callbacks, [
      'cg:pendientes',
      'cg:nota_ingreso_ia',
      'cg:ingreso_ia',
      'cg:ingreso_sin_nota',
    ])
    assert.equal(
      callbacks.some((c) => c?.startsWith('ig:')),
      false,
    )
  })

  it('el depositario no puede abrir la carga de factura del comprador', async () => {
    const db = crearFakeSupabase({
      ci_proyecto_nomina: [{ telegram_chat_id: '900', rol: 'depositario', activo: true }],
    })
    const handled = await manejarCallbackCarga(db as unknown as SupabaseClient, {
      chatId: '900',
      callbackId: 'cb',
      data: 'cg:factura_ia',
    })
    assert.equal(handled, true)
    assert.match(String(telegram.enviados.at(-1)?.text), /depositario no carga/)
    assert.equal(telegram.enviados.at(-1)?.text, MENSAJE_CARGA_FACTURA_NO_DEPOSITARIO)
  })
})
