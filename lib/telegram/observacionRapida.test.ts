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
  esTextoSinObservacion,
  mensajeFotoFueraDePaso,
  observacionDesdeTexto,
} from './observacionRapida'
import {
  manejarCallbackSalidaEgreso,
  manejarFotoSalidaEgreso,
  manejarTextoSalidaEgreso,
} from './salidaEgresoFlujo'
import { manejarCallbackIngresoManual } from './ingresoManualTelegram'
import {
  manejarCallbackTraspasoTelegram,
  manejarFotoTraspasoTelegram,
  manejarTextoTraspasoTelegram,
} from './traspasoFlujoTelegram'
import { manejarFotoEntradaSalidaTelegram } from './entradaSalidaRegistro'

const CHAT = '300'
const SIN_OBSERVACIONES = '⏭ Sin observaciones'

function sesion(contexto: string, metadata: Record<string, unknown>): FakeSupabase {
  return crearFakeSupabase({
    ci_telegram_estados: [
      { chat_id: CHAT, contexto, proyecto_id: 'obra-1', pending_factura_id: null, metadata },
    ],
  })
}

function metadata(db: FakeSupabase): Record<string, unknown> {
  return db.tablas.ci_telegram_estados[0].metadata as Record<string, unknown>
}

function cb(data: string) {
  return { chatId: CHAT, callbackId: 'cb', data }
}

const egresoListo = {
  flujo: 'egreso_v2',
  origen_ubicacion_id: 'ub-1',
  origen_nombre: 'Almacén obra',
  obrero_nombre: 'Pedro Pérez',
  lineas: [
    { material_id: 'm1', material_nombre: 'Cemento', cantidad: 2, unidad: 'SACO', partida_label: 'Friso' },
  ],
}

const foto = { buffer: Buffer.from('jpg'), mimeType: 'image/jpeg', ext: 'jpg' }

describe('texto que significa «sin observaciones»', () => {
  it('reconoce las formas usuales de decir que no hay', () => {
    for (const t of ['-', '.', 'no', 'No.', 'NINGUNA', 'nada', 'n/a', 'Sin observaciones', 'sin observación', '  ']) {
      assert.equal(esTextoSinObservacion(t), true, t)
      assert.equal(observacionDesdeTexto(t), '', t)
    }
  })

  it('respeta una observación real', () => {
    assert.equal(esTextoSinObservacion('No llegó el cemento completo'), false)
    assert.equal(observacionDesdeTexto('  2 sacos rotos '), '2 sacos rotos')
  })
})

describe('observaciones sin escribir', () => {
  let telegram: ReturnType<typeof capturarTelegram>

  beforeEach(() => {
    delete process.env.TELEGRAM_FOTO_OPCIONAL
    telegram = capturarTelegram()
  })
  afterEach(() => telegram.restaurar())

  it('salida a obrero: tras la foto ofrece el botón «Sin observaciones»', async () => {
    const db = sesion('salida_obra', { ...egresoListo, paso: 'foto' })
    await manejarFotoSalidaEgreso({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      userId: '9',
      ...foto,
    })

    assert.equal(metadata(db).paso, 'observacion')
    assert.equal(db.subidas.length, 1)
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), [SIN_OBSERVACIONES])
    assert.doesNotMatch(String(telegram.enviados.at(-1)?.text), /<code>-<\/code>/)
  })

  it('salida a obrero: el botón lleva directo a confirmar', async () => {
    const db = sesion('salida_obra', {
      ...egresoListo,
      paso: 'observacion',
      foto_storage_path: 'telegram-movimientos/obra-1/salida/1.jpg',
    })
    await manejarCallbackSalidaEgreso(db as unknown as SupabaseClient, cb('se:obs:skip'))

    assert.equal(metadata(db).paso, 'confirmar')
    assert.equal(metadata(db).observaciones, '')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['✅ Confirmar egreso'])
  })

  it('salida a obrero: pulsar el botón dos veces no repite la confirmación', async () => {
    const db = sesion('salida_obra', {
      ...egresoListo,
      paso: 'confirmar',
      observaciones: 'Entregado en planta baja',
    })
    await manejarCallbackSalidaEgreso(db as unknown as SupabaseClient, cb('se:obs:skip'))

    assert.equal(metadata(db).observaciones, 'Entregado en planta baja')
    assert.deepEqual(
      telegram.enviados.map((e) => e.metodo),
      ['answerCallbackQuery'],
    )
  })

  it('salida a obrero: el texto que acompaña la foto vale como observación', async () => {
    const db = sesion('salida_obra', { ...egresoListo, paso: 'foto' })
    await manejarFotoSalidaEgreso({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      userId: '9',
      caption: 'Para el friso del piso 2',
      ...foto,
    })

    assert.equal(metadata(db).paso, 'confirmar')
    assert.equal(metadata(db).observaciones, 'Para el friso del piso 2')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['✅ Confirmar egreso'])
  })

  it('salida a obrero: escribir «ninguna» equivale a no tener observaciones', async () => {
    const db = sesion('salida_obra', { ...egresoListo, paso: 'observacion' })
    await manejarTextoSalidaEgreso(db as unknown as SupabaseClient, CHAT, 'Ninguna')

    assert.equal(metadata(db).paso, 'confirmar')
    assert.equal(metadata(db).observaciones, '')
  })

  it('ingreso manual: el botón lleva directo a confirmar', async () => {
    const db = sesion('entrada_obra', {
      flujo: 'ingreso_manual',
      paso: 'observacion',
      ubicacion_nombre: 'Almacén obra',
      proveedor_nombre: 'Ferretería X',
      lineas: [{ material_id: 'm1', material_nombre: 'Cemento', cantidad: 1, unidad: 'SACO' }],
    })
    await manejarCallbackIngresoManual(db as unknown as SupabaseClient, cb('im:obs:skip'))

    assert.equal(metadata(db).paso, 'confirmar')
    assert.equal(metadata(db).observaciones, '')
  })

  it('traspaso: la nota ofrece «Sin nota» y el botón pasa a la foto', async () => {
    const db = crearFakeSupabase({
      ci_telegram_estados: [
        {
          chat_id: CHAT,
          contexto: 'traspaso_inventario',
          proyecto_id: null,
          pending_factura_id: null,
          metadata: { paso: 'cantidad', origen_id: 'ub-o', destino_id: 'ub-d', producto_id: 'm1' },
        },
      ],
      inventario_stock: [{ ubicacion_id: 'ub-o', material_id: 'm1', cantidad_disponible: 50 }],
    })
    await manejarTextoTraspasoTelegram(db as unknown as SupabaseClient, CHAT, '5')
    assert.equal(metadata(db).paso, 'nota')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['⏭ Sin nota'])

    await manejarCallbackTraspasoTelegram(db as unknown as SupabaseClient, cb('tsnn'))
    assert.equal(metadata(db).paso, 'foto')
    assert.equal(metadata(db).nota, '')
  })
})

describe('foto enviada antes de tiempo', () => {
  let telegram: ReturnType<typeof capturarTelegram>

  beforeEach(() => {
    telegram = capturarTelegram()
  })
  afterEach(() => telegram.restaurar())

  it('el mensaje dice que la foto no se guardó y cuándo se pide', () => {
    assert.match(mensajeFotoFueraDePaso('obrero'), /Todavía no toca la foto/)
    assert.match(mensajeFotoFueraDePaso('obrero'), /no se guardó/)
    assert.match(mensajeFotoFueraDePaso('confirmar'), /ya tiene su foto/)
  })

  it('salida a obrero en el paso del obrero: ya no responde «Ya recibí la foto»', async () => {
    const db = sesion('salida_obra', { flujo: 'egreso_v2', paso: 'obrero', origen_ubicacion_id: 'ub-1' })
    const r = await manejarFotoEntradaSalidaTelegram({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      userId: '9',
      photo: [{ file_id: 'f1', width: 10, height: 10 }] as never,
    })

    assert.deepEqual(r, { handled: true, motivo: 'foto_fuera_de_paso' })
    assert.equal(telegram.enviados.length, 1)
    assert.match(String(telegram.enviados[0].text), /Todavía no toca la foto/)
    assert.doesNotMatch(String(telegram.enviados[0].text), /Ya recibí la foto/)
    assert.equal(metadata(db).paso, 'obrero')
    assert.equal(db.subidas.length, 0)
  })

  it('traspaso antes del paso de la foto: avisa y no guarda nada', async () => {
    const db = crearFakeSupabase({
      ci_telegram_estados: [
        {
          chat_id: CHAT,
          contexto: 'traspaso_inventario',
          proyecto_id: null,
          pending_factura_id: null,
          metadata: { paso: 'cantidad' },
        },
      ],
    })
    const manejada = await manejarFotoTraspasoTelegram({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      ...foto,
    })

    assert.equal(manejada, true)
    assert.match(String(telegram.enviados.at(-1)?.text), /Todavía no toca la foto/)
    assert.equal(db.subidas.length, 0)
    assert.equal(metadata(db).paso, 'cantidad')
  })
})
