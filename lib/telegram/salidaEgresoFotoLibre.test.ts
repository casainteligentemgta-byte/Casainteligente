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
  manejarCallbackSalidaEgreso,
  manejarFotoSalidaEgreso,
  manejarOrigenSalidaEgreso,
  manejarTextoSalidaEgreso,
} from './salidaEgresoFlujo'

const CHAT = '400'
const OBRA = 'obra-1'
const ALMACEN = 'ub-1'

/** Sesión de salida a obrero con almacén ya elegido; el almacén tiene 10 de alambre. */
function sesion(
  metadata: Record<string, unknown>,
  tablas: Record<string, Array<Record<string, unknown>>> = {},
): FakeSupabase {
  return crearFakeSupabase({
    ci_telegram_estados: [
      {
        chat_id: CHAT,
        contexto: 'salida_obra',
        proyecto_id: OBRA,
        pending_factura_id: null,
        metadata: {
          flujo: 'egreso_v2',
          origen_ubicacion_id: ALMACEN,
          origen_nombre: 'TERRENO JC',
          lineas: [],
          ...metadata,
        },
      },
    ],
    inventario_stock: [{ ubicacion_id: ALMACEN, material_id: 'm1', cantidad_disponible: 10 }],
    global_inventory: [{ id: 'm1', name: 'Alambre liso', unit: 'KG' }],
    ...tablas,
  })
}

function metadata(db: FakeSupabase): Record<string, unknown> {
  return db.tablas.ci_telegram_estados[0].metadata as Record<string, unknown>
}

function textos(telegram: ReturnType<typeof capturarTelegram>): string {
  return telegram.enviados.map((e) => String(e.text ?? '')).join('\n')
}

const foto = { userId: '9', buffer: Buffer.from('jpg'), mimeType: 'image/jpeg', ext: 'jpg' }
const lineaLista = {
  material_id: 'm1',
  material_nombre: 'Alambre liso',
  cantidad: 2,
  unidad: 'KG',
  partida_label: 'Sin partida',
}

describe('salida a obrero: quién recibe', () => {
  let telegram: ReturnType<typeof capturarTelegram>

  beforeEach(() => {
    delete process.env.TELEGRAM_FOTO_OPCIONAL
    telegram = capturarTelegram()
  })
  afterEach(() => telegram.restaurar())

  it('sin cuadrilla cargada pide el nombre de una vez, sin botones', async () => {
    const db = sesion({ paso: 'origen', origen_ubicacion_id: undefined })
    await manejarOrigenSalidaEgreso(db as unknown as SupabaseClient, CHAT, ALMACEN, 'TERRENO JC')

    assert.equal(metadata(db).paso, 'obrero')
    const ultimo = telegram.enviados.at(-1)
    assert.match(String(ultimo?.text), /Quién recibe el material/)
    assert.match(String(ultimo?.text), /nombre y apellido/)
    assert.deepEqual(botonesDe(ultimo), [])
  })

  it('con cuadrilla muestra la lista', async () => {
    const db = sesion(
      { paso: 'origen', origen_ubicacion_id: undefined },
      {
        ci_obra_empleados: [{ obra_id: OBRA, empleado_id: 'e1' }],
        ci_empleados: [{ id: 'e1', nombre_completo: 'Pedro Pérez', cargo_nombre: 'Albañil' }],
      },
    )
    await manejarOrigenSalidaEgreso(db as unknown as SupabaseClient, CHAT, ALMACEN, 'TERRENO JC')

    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), [
      '✏️ Escribir nombre y apellido',
      'Pedro Pérez · Albañil',
    ])
  })

  it('escribir el nombre sin pulsar ningún botón avanza a elegir material', async () => {
    const db = sesion({ paso: 'obrero' })
    const manejado = await manejarTextoSalidaEgreso(
      db as unknown as SupabaseClient,
      CHAT,
      'Juan Pérez, Albañil',
    )

    assert.equal(manejado, true)
    assert.equal(metadata(db).paso, 'material')
    assert.equal(metadata(db).obrero_nombre, 'Juan Pérez')
    assert.equal(metadata(db).obrero_oficio, 'Albañil')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['Alambre liso (10 KG)'])
  })

  it('un comando escrito en ese paso no se toma como nombre', async () => {
    const db = sesion({ paso: 'obrero' })
    const manejado = await manejarTextoSalidaEgreso(db as unknown as SupabaseClient, CHAT, '/salida')
    assert.equal(manejado, false)
    assert.equal(metadata(db).paso, 'obrero')
  })
})

describe('salida a obrero: la foto se acepta en cualquier paso', () => {
  let telegram: ReturnType<typeof capturarTelegram>

  beforeEach(() => {
    delete process.env.TELEGRAM_FOTO_OPCIONAL
    telegram = capturarTelegram()
  })
  afterEach(() => telegram.restaurar())

  it('foto enviada al elegir quién recibe: se guarda y repite lo que falta', async () => {
    const db = sesion({ paso: 'obrero' })
    const manejada = await manejarFotoSalidaEgreso({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      ...foto,
    })

    assert.equal(manejada, true)
    assert.equal(db.subidas.length, 1)
    assert.equal(metadata(db).paso, 'obrero')
    assert.ok(String(metadata(db).foto_storage_path).startsWith(`telegram-movimientos/${OBRA}/salida/`))
    assert.match(textos(telegram), /Foto guardada/)
    assert.doesNotMatch(textos(telegram), /Todavía no toca la foto/)
    assert.match(String(telegram.enviados.at(-1)?.text), /Quién recibe el material/)
  })

  it('foto enviada al elegir material: se guarda y vuelve a mostrar los materiales', async () => {
    const db = sesion({ paso: 'material', obrero_nombre: 'Juan Pérez' })
    await manejarFotoSalidaEgreso({
      supabase: db as unknown as SupabaseClient,
      chatId: CHAT,
      caption: 'Para la cerca',
      ...foto,
    })

    assert.equal(metadata(db).paso, 'material')
    assert.equal(metadata(db).observaciones, 'Para la cerca')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['Alambre liso (10 KG)'])
  })

  it('si la foto ya llegó, al terminar los materiales no la vuelve a pedir', async () => {
    const db = sesion({
      paso: 'mas_lineas',
      obrero_nombre: 'Juan Pérez',
      lineas: [lineaLista],
      foto_storage_path: `telegram-movimientos/${OBRA}/salida/1.jpg`,
    })
    await manejarCallbackSalidaEgreso(db as unknown as SupabaseClient, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'se:mas:no',
    })

    assert.equal(metadata(db).paso, 'observacion')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['⏭ Sin observaciones'])
    assert.doesNotMatch(textos(telegram), /obligatoria/)
  })

  it('si la foto llegó con texto, pasa directo a confirmar', async () => {
    const db = sesion({
      paso: 'mas_lineas',
      obrero_nombre: 'Juan Pérez',
      lineas: [lineaLista],
      foto_storage_path: `telegram-movimientos/${OBRA}/salida/1.jpg`,
      observaciones: 'Para la cerca',
    })
    await manejarCallbackSalidaEgreso(db as unknown as SupabaseClient, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'se:mas:no',
    })

    assert.equal(metadata(db).paso, 'confirmar')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['✅ Confirmar egreso'])
  })

  it('sin foto previa la sigue pidiendo como obligatoria', async () => {
    const db = sesion({ paso: 'mas_lineas', obrero_nombre: 'Juan Pérez', lineas: [lineaLista] })
    await manejarCallbackSalidaEgreso(db as unknown as SupabaseClient, {
      chatId: CHAT,
      callbackId: 'cb',
      data: 'se:mas:no',
    })

    assert.equal(metadata(db).paso, 'foto')
    assert.match(String(telegram.enviados.at(-1)?.text), /obligatoria/)
  })

  it('escribir texto donde tocan botones repite lo que falta en vez de callar', async () => {
    const db = sesion({ paso: 'material', obrero_nombre: 'Juan Pérez' })
    const manejado = await manejarTextoSalidaEgreso(db as unknown as SupabaseClient, CHAT, 'alambre')

    assert.equal(manejado, true)
    assert.equal(metadata(db).paso, 'material')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['Alambre liso (10 KG)'])
  })
})
