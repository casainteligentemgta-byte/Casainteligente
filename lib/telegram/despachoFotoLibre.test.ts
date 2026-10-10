import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { botonesDe, capturarTelegram, crearFakeSupabase, type FakeSupabase } from './testing/fakeSupabase'
import {
  FLUJO_SALIDA_ALMACEN,
  manejarCallbackSalidaObraTelegram,
  manejarComandoSalidaObraTelegram,
  manejarFotoSalidaAlmacenTelegram,
} from './salidaObraTelegram'

const CHAT = '410'
const FOTO_PREVIA = 'telegram-movimientos/obra-1/salida-almacen/1.jpg'

function sesion(paso: string, extra: Record<string, unknown> = {}, proyecto: string | null = 'obra-1'): FakeSupabase {
  return crearFakeSupabase({
    ci_telegram_estados: [
      {
        chat_id: CHAT,
        contexto: 'salida_obra',
        proyecto_id: proyecto,
        pending_factura_id: null,
        metadata: {
          flujo: FLUJO_SALIDA_ALMACEN,
          paso,
          origen_nombre: 'Almacén obra',
          lineas: [{ material_id: 'm1', material_nombre: 'Cemento', cantidad: 2, unidad: 'SACO' }],
          ...extra,
        },
      },
    ],
  })
}

function metadata(db: FakeSupabase): Record<string, unknown> {
  return db.tablas.ci_telegram_estados[0].metadata as Record<string, unknown>
}

const foto = { userId: '9', buffer: Buffer.from('jpg'), mimeType: 'image/jpeg', ext: 'jpg' }

describe('despacho de almacén: la foto se acepta en cualquier momento', () => {
  let telegram: ReturnType<typeof capturarTelegram>

  beforeEach(() => {
    delete process.env.TELEGRAM_FOTO_OPCIONAL
    telegram = capturarTelegram()
  })
  afterEach(() => telegram.restaurar())

  it('antes del paso de la foto: la guarda y sigue en el mismo paso', async () => {
    const db = sesion('material')
    const manejada = await manejarFotoSalidaAlmacenTelegram({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      ...foto,
    })

    assert.equal(manejada, true)
    assert.equal(db.subidas.length, 1)
    assert.match(db.subidas[0], /^ci-proyectos-media\/telegram-movimientos\/obra-1\/salida-almacen\//)
    assert.equal(metadata(db).paso, 'material')
    assert.ok(String(metadata(db).foto_storage_path).endsWith('.jpg'))
    assert.match(String(telegram.enviados.at(-1)?.text), /No tendrá que enviarla de nuevo/)
  })

  it('con la foto ya guardada, al terminar los materiales va directo a confirmar', async () => {
    const db = sesion('mas_lineas', { foto_storage_path: FOTO_PREVIA })
    await manejarCallbackSalidaObraTelegram(db as unknown as SupabaseClient, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'sa:mas:no',
    })

    assert.equal(metadata(db).paso, 'confirmar')
    const ultimo = telegram.enviados.at(-1)
    assert.match(String(ultimo?.text), /Con foto adjunta/)
    assert.deepEqual(botonesDe(ultimo), ['🚀 Registrar salida'])
    assert.ok(!telegram.enviados.some((e) => /obligatoria/.test(String(e.text))))
  })

  it('en el paso de la foto se comporta como siempre: guarda y confirma', async () => {
    const db = sesion('foto')
    await manejarFotoSalidaAlmacenTelegram({ supabase: db as unknown as SupabaseClient, chatId: CHAT, ...foto })

    assert.equal(db.subidas.length, 1)
    assert.equal(metadata(db).paso, 'confirmar')
  })

  it('sin obra elegida todavía no se acepta (no hay dónde guardarla)', async () => {
    const db = sesion('almacen', {}, null)
    const manejada = await manejarFotoSalidaAlmacenTelegram({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      ...foto,
    })

    assert.equal(manejada, false)
    assert.equal(db.subidas.length, 0)
  })

  it('en la confirmación avisa que ya tiene su foto y no guarda otra', async () => {
    const db = sesion('confirmar', { foto_storage_path: FOTO_PREVIA })
    await manejarFotoSalidaAlmacenTelegram({ supabase: db as unknown as SupabaseClient, chatId: CHAT, ...foto })

    assert.equal(db.subidas.length, 0)
    assert.match(String(telegram.enviados.at(-1)?.text), /ya tiene su foto/)
  })

  it('un despacho nuevo no hereda la foto de uno anterior', async () => {
    const db = sesion('material', { foto_storage_path: FOTO_PREVIA })
    await manejarComandoSalidaObraTelegram(db as unknown as SupabaseClient, CHAT)

    assert.equal(metadata(db).paso, 'almacen')
    assert.equal(metadata(db).foto_storage_path, undefined)
    assert.deepEqual(metadata(db).lineas, [])
  })
})
