import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  botonesDe,
  capturarTelegram,
  crearFakeSupabase,
  type FakeSupabase,
} from './testing/fakeSupabase'
import {
  guardarFotoTransferencia,
  manejarCallbackTraspasoTelegram,
  manejarFotoTraspasoTelegram,
  manejarTextoTraspasoTelegram,
} from './traspasoFlujoTelegram'

const CHAT = '100'

function sesionTraspaso(paso: string, extra: Record<string, unknown> = {}): FakeSupabase {
  return crearFakeSupabase({
    ci_telegram_estados: [
      {
        chat_id: CHAT,
        contexto: 'traspaso_inventario',
        proyecto_id: null,
        pending_factura_id: null,
        metadata: {
          paso,
          origen_id: 'ub-origen',
          origen_nombre: 'Almacén central',
          destino_id: 'ub-destino',
          destino_nombre: 'Obra Norte',
          producto_id: 'mat-1',
          producto_nombre: 'Cemento gris',
          cantidad: 10,
          ...extra,
        },
      },
    ],
  })
}

function metadata(db: FakeSupabase): Record<string, unknown> {
  return db.tablas.ci_telegram_estados[0].metadata as Record<string, unknown>
}

const foto = { buffer: Buffer.from('jpg'), mimeType: 'image/jpeg', ext: 'jpg' }

describe('traspaso: la foto es parte del registro', () => {
  let telegram: ReturnType<typeof capturarTelegram>

  beforeEach(() => {
    delete process.env.TELEGRAM_FOTO_OPCIONAL
    telegram = capturarTelegram()
  })
  afterEach(() => {
    telegram.restaurar()
    delete process.env.TELEGRAM_FOTO_OPCIONAL
  })

  it('tras la nota pide la foto y no ofrece omitirla', async () => {
    const db = sesionTraspaso('nota')
    await manejarTextoTraspasoTelegram(db as unknown as SupabaseClient, CHAT, 'Chofer Luis, placa AB123')

    assert.equal(metadata(db).paso, 'foto')
    assert.equal(metadata(db).nota, 'Chofer Luis, placa AB123')
    const ultimo = telegram.enviados.at(-1)
    assert.match(String(ultimo?.text), /obligatoria/)
    assert.deepEqual(botonesDe(ultimo), [])
  })

  it('confirmar sin foto no mueve el stock y vuelve a pedirla', async () => {
    const db = sesionTraspaso('confirmar')
    await manejarCallbackTraspasoTelegram(db as unknown as SupabaseClient, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'tsok',
    })

    assert.equal(db.tablas.transferencias_inventario, undefined)
    assert.equal(metadata(db).paso, 'foto')
    assert.equal(telegram.enviados[0].metodo, 'answerCallbackQuery')
    assert.equal(telegram.enviados[0].show_alert, true)
  })

  it('el botón «Omitir» de un mensaje viejo ya no avanza', async () => {
    const db = sesionTraspaso('foto')
    await manejarCallbackTraspasoTelegram(db as unknown as SupabaseClient, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'tsfs',
    })

    assert.equal(metadata(db).paso, 'foto')
    assert.equal(telegram.enviados.length, 1)
    assert.equal(telegram.enviados[0].show_alert, true)
  })

  it('al recibir la foto la guarda y muestra la confirmación', async () => {
    const db = sesionTraspaso('foto')
    const manejado = await manejarFotoTraspasoTelegram({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      ...foto,
    })

    assert.equal(manejado, true)
    assert.equal(db.subidas.length, 1)
    assert.match(db.subidas[0], /^ci-proyectos-media\/telegram-movimientos\/traspasos\/100\//)
    assert.equal(metadata(db).paso, 'confirmar')
    assert.ok(String(metadata(db).foto_storage_path).endsWith('.jpg'))
    const resumen = telegram.enviados.at(-1)
    assert.match(String(resumen?.text), /Foto: adjunta/)
    assert.deepEqual(botonesDe(resumen), ['🔒 Confirmar despacho', '❌ Cancelar'])
  })

  it('si la foto no se puede guardar, sigue en el paso de foto', async () => {
    const db = crearFakeSupabase(sesionTraspaso('foto').tablas, { storageCaido: true })
    await manejarFotoTraspasoTelegram({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      ...foto,
    })

    assert.equal(metadata(db).paso, 'foto')
    assert.equal(metadata(db).foto_storage_path, undefined)
    assert.match(String(telegram.enviados.at(-1)?.text), /No se pudo guardar/)
  })

  it('una foto fuera del paso de foto no se guarda y se avisa cuándo toca', async () => {
    const db = sesionTraspaso('cantidad')
    const manejado = await manejarFotoTraspasoTelegram({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      ...foto,
    })
    assert.equal(manejado, true)
    assert.equal(db.subidas.length, 0)
    assert.equal(metadata(db).paso, 'cantidad')
    assert.match(String(telegram.enviados.at(-1)?.text), /Todavía no toca la foto/)
  })

  it('con TELEGRAM_FOTO_OPCIONAL=1 se puede omitir', async () => {
    process.env.TELEGRAM_FOTO_OPCIONAL = '1'
    const db = sesionTraspaso('nota')
    await manejarTextoTraspasoTelegram(db as unknown as SupabaseClient, CHAT, 'sin novedad')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['⏭ Omitir foto'])

    await manejarCallbackTraspasoTelegram(db as unknown as SupabaseClient, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'tsfs',
    })
    assert.equal(metadata(db).paso, 'confirmar')
  })
})

describe('traspaso: dónde queda la foto en la transferencia', () => {
  const evidencia = { storage_path: 'telegram-movimientos/traspasos/100/1.jpg', url: 'https://x/1.jpg' }

  it('la guarda en la columna fotos', async () => {
    const db = crearFakeSupabase({
      transferencias_inventario: [{ id: 't1', observaciones: 'Chofer Luis' }],
    })
    await guardarFotoTransferencia(db as unknown as SupabaseClient, 't1', evidencia, 'Chofer Luis')

    assert.deepEqual(db.tablas.transferencias_inventario[0].fotos, [evidencia])
    assert.equal(db.tablas.transferencias_inventario[0].observaciones, 'Chofer Luis')
  })

  it('sin la migración 340 deja la ruta en observaciones', async () => {
    const db = crearFakeSupabase(
      { transferencias_inventario: [{ id: 't1', observaciones: 'Chofer Luis' }] },
      { columnasAusentes: { transferencias_inventario: ['fotos'] } },
    )
    await guardarFotoTransferencia(db as unknown as SupabaseClient, 't1', evidencia, 'Chofer Luis')

    assert.equal(db.tablas.transferencias_inventario[0].fotos, undefined)
    assert.equal(
      db.tablas.transferencias_inventario[0].observaciones,
      'Chofer Luis · Foto: telegram-movimientos/traspasos/100/1.jpg',
    )
  })
})
