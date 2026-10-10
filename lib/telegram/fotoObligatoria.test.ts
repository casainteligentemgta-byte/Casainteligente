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
  etiquetaRequisitoFoto,
  fotoMovimientoObligatoria,
  fotosSuficientes,
} from './fotoObligatoria'
import { tecladoSoporteFotosTelegram } from './tecladoSoporteFotoTelegram'
import { manejarCallbackSalidaEgreso } from './salidaEgresoFlujo'
import { manejarCallbackSalidaObraTelegram } from './salidaObraTelegram'
import { manejarCallbackIngresoFacturaTelegram } from './ingresoFacturaTelegram'
import { manejarCallbackIngresoManual } from './ingresoManualTelegram'
import { manejarCallbackFacturaCompradorManual } from './facturaCompradorManualTelegram'

const CHAT = '200'

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

describe('regla de foto obligatoria', () => {
  afterEach(() => {
    delete process.env.TELEGRAM_FOTO_OPCIONAL
  })

  it('es obligatoria salvo que se relaje por configuración', () => {
    delete process.env.TELEGRAM_FOTO_OPCIONAL
    assert.equal(fotoMovimientoObligatoria(), true)
    assert.equal(etiquetaRequisitoFoto(), '(obligatoria)')
    assert.equal(fotosSuficientes(0), false)
    assert.equal(fotosSuficientes(1), true)

    process.env.TELEGRAM_FOTO_OPCIONAL = '1'
    assert.equal(fotoMovimientoObligatoria(), false)
    assert.equal(etiquetaRequisitoFoto(), '(opcional)')
    assert.equal(fotosSuficientes(0), true)
  })

  it('el teclado de fotos solo ofrece «Omitir» cuando es opcional', () => {
    delete process.env.TELEGRAM_FOTO_OPCIONAL
    const obligatorio = tecladoSoporteFotosTelegram('x:').inline_keyboard.flat().map((b) => b.text)
    assert.deepEqual(obligatorio, ['❓ ¿Cómo envío la foto?', '✅ Listo con fotos'])

    process.env.TELEGRAM_FOTO_OPCIONAL = 'true'
    const opcional = tecladoSoporteFotosTelegram('x:').inline_keyboard.flat().map((b) => b.text)
    assert.ok(opcional.includes('⏭ Omitir fotos'))
  })
})

describe('ningún flujo de almacén se registra sin foto', () => {
  let telegram: ReturnType<typeof capturarTelegram>

  beforeEach(() => {
    delete process.env.TELEGRAM_FOTO_OPCIONAL
    telegram = capturarTelegram()
  })
  afterEach(() => telegram.restaurar())

  /** El bot respondió con una alerta emergente y no avanzó. */
  function soloAlerta(): void {
    assert.equal(telegram.enviados.length, 1)
    assert.equal(telegram.enviados[0].metodo, 'answerCallbackQuery')
    assert.equal(telegram.enviados[0].show_alert, true)
  }

  it('salida a obrero: «Omitir» viejo no avanza', async () => {
    const db = sesion('salida_obra', { flujo: 'egreso_v2', paso: 'foto' })
    await manejarCallbackSalidaEgreso(db as unknown as SupabaseClient, cb('se:foto:skip'))
    soloAlerta()
    assert.equal(metadata(db).paso, 'foto')
  })

  it('salida a obrero: confirmar sin foto no descuenta stock', async () => {
    const db = sesion('salida_obra', {
      flujo: 'egreso_v2',
      paso: 'confirmar',
      origen_ubicacion_id: 'ub-1',
      obrero_nombre: 'Pedro Pérez',
      lineas: [{ material_id: 'm1', material_nombre: 'Cemento', cantidad: 2, unidad: 'SACO' }],
    })
    await manejarCallbackSalidaEgreso(db as unknown as SupabaseClient, cb('se:conf:ok'))

    assert.equal(metadata(db).paso, 'foto')
    assert.equal(db.tablas.inv_egresos_campo, undefined)
    assert.equal(db.tablas.transferencias_inventario, undefined)
    assert.match(String(telegram.enviados.at(-1)?.text), /foto es obligatoria/)
  })

  it('despacho: «Omitir» viejo no avanza', async () => {
    const db = sesion('salida_obra', { flujo: 'salida_almacen', paso: 'foto' })
    await manejarCallbackSalidaObraTelegram(db as unknown as SupabaseClient, cb('sa:foto:skip'))
    soloAlerta()
    assert.equal(metadata(db).paso, 'foto')
  })

  it('despacho: confirmar sin foto no descuenta stock', async () => {
    const db = sesion('salida_obra', {
      flujo: 'salida_almacen',
      paso: 'confirmar',
      origen_ubicacion_id: 'ub-1',
      obrero_nombre: 'Pedro Pérez',
      lineas: [{ material_id: 'm1', material_nombre: 'Cemento', cantidad: 2, unidad: 'SACO' }],
    })
    await manejarCallbackSalidaObraTelegram(db as unknown as SupabaseClient, cb('sa:conf:ok'))

    assert.equal(metadata(db).paso, 'foto')
    assert.equal(db.tablas.transferencias_inventario, undefined)
    assert.match(String(telegram.enviados.at(-1)?.text), /foto es obligatoria/)
  })

  it('recepción de factura precargada: «Listo» sin fotos no avanza', async () => {
    const db = sesion('entrada_obra', { flujo: 'ingreso_factura', paso: 'foto', fotos_storage_paths: [] })
    await manejarCallbackIngresoFacturaTelegram(db as unknown as SupabaseClient, cb('ifp:foto:done'))
    soloAlerta()
    assert.equal(metadata(db).paso, 'foto')
  })

  it('recepción de factura precargada: con una foto sí avanza', async () => {
    const db = sesion('entrada_obra', {
      flujo: 'ingreso_factura',
      paso: 'foto',
      proveedor_nombre: 'Ferretería X',
      invoice_number: '123',
      items: [],
      fotos_storage_paths: ['recepciones-campo/a.jpg'],
    })
    await manejarCallbackIngresoFacturaTelegram(db as unknown as SupabaseClient, cb('ifp:foto:done'))

    assert.equal(metadata(db).paso, 'confirmar')
    assert.deepEqual(botonesDe(telegram.enviados.at(-1)), ['🚀 Registrar ingreso a almacén'])
  })

  it('ingreso manual: «Listo» sin fotos no avanza', async () => {
    const db = sesion('entrada_obra', { flujo: 'ingreso_manual', paso: 'foto', lineas: [] })
    await manejarCallbackIngresoManual(db as unknown as SupabaseClient, cb('im:foto:done'))
    soloAlerta()
    assert.equal(metadata(db).paso, 'foto')
  })

  it('ingreso manual: la foto tomada por línea cuenta como soporte', async () => {
    const db = sesion('entrada_obra', {
      flujo: 'ingreso_manual',
      paso: 'foto',
      lineas: [{ material_id: 'm1', cantidad: 1, soporte_storage_path: 'recepciones-campo/l.jpg' }],
    })
    await manejarCallbackIngresoManual(db as unknown as SupabaseClient, cb('im:foto:done'))
    assert.equal(metadata(db).paso, 'observacion')
  })

  it('factura del comprador: «Omitir» viejo no avanza', async () => {
    const db = sesion('factura', { flujo: 'factura_comprador_manual', paso: 'foto', lineas: [] })
    await manejarCallbackFacturaCompradorManual(db as unknown as SupabaseClient, cb('fcm:foto:skip'))
    soloAlerta()
    assert.equal(metadata(db).paso, 'foto')
    assert.equal(db.tablas.ci_facturas_canal_pendientes, undefined)
  })
})
