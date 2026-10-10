import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  botonesDe,
  capturarTelegram,
  crearFakeSupabase,
  type FakeSupabase,
  type MensajeTelegramCapturado,
} from './testing/fakeSupabase'
import { despacharRequerimientoSalida, obtenerRequerimientoSalida } from '../almacen/requerimientoSalida'
import {
  iniciarRequerimientoSalidaTelegram,
  manejarCallbackRequerimientoSalida,
  manejarFotoRequerimientoSalida,
  manejarTextoRequerimientoSalida,
} from './requerimientoSalidaTelegram'

const OBRA_A = '11111111-1111-4111-8111-111111111111'
const OBRA_B = '22222222-2222-4222-8222-222222222222'
const UB_OBRA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const UB_OBRA_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const UB_ALMACEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
const UB_DEVOLUCIONES = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'
const UB_BAJAS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
const CEMENTO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const INGENIERO = '300'
const DEPOSITARIO = '900'

function ubicacion(id: string, codigo: string, nombre: string, tipo: string, proyecto: string | null) {
  return { id, codigo, nombre, tipo, ci_proyecto_id: proyecto, activo: true, ubicacion_padre_id: null }
}

function baseDeDatos(opts: { conDepositario?: boolean } = {}): FakeSupabase {
  return crearFakeSupabase({
    ci_proyectos: [
      {
        id: OBRA_A,
        nombre: 'Obra Norte',
        depositario_id: opts.conDepositario === false ? null : 'emp-dep',
        telegram_grupo_almacen_id: null,
      },
      { id: OBRA_B, nombre: 'Obra Sur', depositario_id: null, telegram_grupo_almacen_id: null },
    ],
    ci_empleados: [{ id: 'emp-dep', telegram_chat_id: 900, nombre_completo: 'Dora Depósito' }],
    ci_proyecto_nomina: [],
    inv_ubicaciones: [
      ubicacion(UB_OBRA_A, 'OBRA-A', 'Obra Norte', 'obra', OBRA_A),
      ubicacion(UB_OBRA_B, 'OBRA-B', 'Obra Sur', 'obra', OBRA_B),
      ubicacion(UB_ALMACEN, 'DEP-A', 'Almacén Norte', 'almacen_central', OBRA_A),
      ubicacion(UB_DEVOLUCIONES, 'DEVOLUCIONES', 'Devoluciones a proveedor', 'garantias', null),
      ubicacion(UB_BAJAS, 'BAJAS', 'Deterioro y bajas', 'garantias', null),
    ],
    inventario_stock: [{ ubicacion_id: UB_ALMACEN, material_id: CEMENTO, cantidad_disponible: 10 }],
    global_inventory: [{ id: CEMENTO, name: 'Cemento gris', unit: 'SACO' }],
    ci_telegram_estados: [],
  })
}

const foto = { buffer: Buffer.from('jpg'), mimeType: 'image/jpeg', ext: 'jpg' }

describe('requerimiento de salida de almacén', () => {
  let telegram: ReturnType<typeof capturarTelegram>
  let db: FakeSupabase
  const sb = () => db as unknown as SupabaseClient

  const requerimiento = () => db.tablas.inv_requerimientos_salida?.[0]
  const mensajesA = (chat: string): MensajeTelegramCapturado[] =>
    telegram.enviados.filter((m) => m.metodo === 'sendMessage' && String(m.chat_id) === chat)
  const ultimoA = (chat: string) => mensajesA(chat).at(-1)
  const alertas = () => telegram.enviados.filter((m) => m.metodo === 'answerCallbackQuery' && m.show_alert)
  const sesion = () =>
    db.tablas.ci_telegram_estados.find((e) => e.chat_id === INGENIERO) as
      | { contexto: string; metadata: Record<string, unknown> }
      | undefined

  const pulsar = (chat: string, data: string, nombre = 'Ana') =>
    manejarCallbackRequerimientoSalida(sb(), { chatId: chat, callbackId: 'cb', data, nombre })
  const escribir = (texto: string) => manejarTextoRequerimientoSalida(sb(), INGENIERO, texto)

  /** El ingeniero arma el pedido hasta la pantalla de revisión. */
  async function armarPedido(tipo: string, cantidad = '4', motivo = 'vaciado de losa nivel 2') {
    await iniciarRequerimientoSalidaTelegram(sb(), INGENIERO)
    await pulsar(INGENIERO, `rq:o:${OBRA_A}`)
    await pulsar(INGENIERO, `rq:m:${CEMENTO}`)
    await escribir(cantidad)
    await pulsar(INGENIERO, `rq:t:${tipo}`)
    if (tipo === 'traspaso') await pulsar(INGENIERO, `rq:d:${UB_OBRA_B}`)
    await escribir(motivo)
  }

  async function pedirYEnviar(tipo: string) {
    await armarPedido(tipo)
    await pulsar(INGENIERO, 'rq:ok')
    telegram.enviados.length = 0
  }

  beforeEach(() => {
    telegram = capturarTelegram()
    db = baseDeDatos()
  })
  afterEach(() => telegram.restaurar())

  it('empieza preguntando la obra', async () => {
    await iniciarRequerimientoSalidaTelegram(sb(), INGENIERO)
    assert.deepEqual(botonesDe(ultimoA(INGENIERO)), ['🏗 Obra Norte', '🏗 Obra Sur'])
    assert.equal(sesion()?.contexto, 'salida_obra')
  })

  it('sin la migración 343 lo dice y no abre el flujo', async () => {
    db = crearFakeSupabase(baseDeDatos().tablas, { tablasAusentes: ['inv_requerimientos_salida'] })
    await iniciarRequerimientoSalidaTelegram(sb(), INGENIERO)
    assert.match(String(ultimoA(INGENIERO)?.text), /todavía no está activado/)
    assert.equal(sesion(), undefined)
  })

  it('con un solo almacén pasa directo a los materiales con stock', async () => {
    await iniciarRequerimientoSalidaTelegram(sb(), INGENIERO)
    await pulsar(INGENIERO, `rq:o:${OBRA_A}`)
    assert.deepEqual(botonesDe(ultimoA(INGENIERO)), ['📦 Cemento gris (10 SACO)'])
    assert.equal(sesion()?.metadata.origen_nombre, 'Almacén Norte')
  })

  it('no deja pedir más de lo que hay', async () => {
    await iniciarRequerimientoSalidaTelegram(sb(), INGENIERO)
    await pulsar(INGENIERO, `rq:o:${OBRA_A}`)
    await pulsar(INGENIERO, `rq:m:${CEMENTO}`)
    await escribir('50')
    assert.match(String(ultimoA(INGENIERO)?.text), /hay <b>10 SACO<\/b>/)
    assert.equal(sesion()?.metadata.paso, 'rq_cantidad')

    await escribir('abc')
    assert.equal(sesion()?.metadata.paso, 'rq_cantidad')
  })

  it('ofrece los cinco motivos de salida', async () => {
    await iniciarRequerimientoSalidaTelegram(sb(), INGENIERO)
    await pulsar(INGENIERO, `rq:o:${OBRA_A}`)
    await pulsar(INGENIERO, `rq:m:${CEMENTO}`)
    await escribir('4')
    assert.deepEqual(botonesDe(ultimoA(INGENIERO)), [
      'Uso en obra',
      'Colocación en obra',
      'Traspaso a otra obra',
      'Devolución a proveedor',
      'Deterioro o pérdida',
    ])
  })

  it('al enviar crea el requerimiento, avisa al almacén y no toca el stock', async () => {
    await armarPedido('uso')
    assert.match(String(ultimoA(INGENIERO)?.text), /Revise su pedido/)
    await pulsar(INGENIERO, 'rq:ok')

    const r = requerimiento()
    assert.equal(r.estado, 'solicitado')
    assert.equal(r.tipo, 'uso')
    assert.equal(r.cantidad, 4)
    assert.equal(r.motivo, 'vaciado de losa nivel 2')
    assert.match(String(r.codigo), /^RS-/)
    const aviso = ultimoA(DEPOSITARIO)
    assert.match(String(aviso?.text), /Requerimiento de salida/)
    assert.match(String(aviso?.text), /4 SACO<\/b> · Cemento gris/)
    assert.match(String(aviso?.text), /Uso en obra/)
    assert.deepEqual(botonesDe(aviso), ['✅ Despachar', '❌ Rechazar'])
    assert.match(String(ultimoA(INGENIERO)?.text), /Pedido enviado al almacén/)
    assert.equal(sesion()?.contexto, 'menu')
    assert.equal(db.tablas.inventario_stock[0].cantidad_disponible, 10)
    assert.equal(db.tablas.transferencias_inventario, undefined)
  })

  it('si la obra no tiene a nadie del almacén con Telegram, no crea el pedido', async () => {
    db = baseDeDatos({ conDepositario: false })
    await armarPedido('uso')
    await pulsar(INGENIERO, 'rq:ok')

    assert.equal(requerimiento(), undefined)
    assert.match(String(ultimoA(INGENIERO)?.text), /no tiene a nadie del almacén/)
  })

  it('quien pide no puede despachar su propio pedido', async () => {
    await pedirYEnviar('uso')
    await pulsar(INGENIERO, `rq:dk:${requerimiento().id}`)

    assert.equal(requerimiento().estado, 'solicitado')
    assert.match(String(alertas()[0].text), /debe despacharlo otra persona/)
  })

  it('el almacén lo toma y se le pide la foto; un segundo toque ya no lo toma', async () => {
    await pedirYEnviar('uso')
    await pulsar(DEPOSITARIO, `rq:dk:${requerimiento().id}`, 'Dora')

    assert.equal(requerimiento().estado, 'en_despacho')
    assert.equal(requerimiento().despachador_chat_id, 900)
    assert.match(String(ultimoA(DEPOSITARIO)?.text), /foto del material/)
    assert.deepEqual(botonesDe(ultimoA(DEPOSITARIO)), ['↩️ No lo despacho yo', '❌ Rechazar'])
    assert.match(String(ultimoA(INGENIERO)?.text), /está despachando su pedido/)

    telegram.enviados.length = 0
    await pulsar('901', `rq:dk:${requerimiento().id}`, 'Otro')
    assert.equal(requerimiento().despachador_chat_id, 900)
    assert.match(String(alertas()[0].text), /Ya lo está despachando/)
  })

  it('uso en obra: con la foto sale hacia la obra y avisa a quien pidió', async () => {
    await pedirYEnviar('uso')
    await pulsar(DEPOSITARIO, `rq:dk:${requerimiento().id}`, 'Dora')
    telegram.enviados.length = 0

    const manejado = await manejarFotoRequerimientoSalida({ supabase: sb(), chatId: DEPOSITARIO, ...foto })

    assert.equal(manejado, true)
    assert.equal(requerimiento().estado, 'despachado')
    assert.equal((requerimiento().fotos as unknown[]).length, 1)
    const trf = db.tablas.transferencias_inventario[0]
    assert.equal(trf.tipo_movimiento, 'salida_obra')
    assert.equal(trf.origen_ubicacion_id, UB_ALMACEN)
    assert.equal(trf.destino_ubicacion_id, UB_OBRA_A)
    assert.equal(trf.estado, 'completado')
    assert.equal(requerimiento().transferencia_id, trf.id)
    assert.match(db.subidas[0], /^ci-proyectos-media\/telegram-movimientos\//)
    assert.match(String(ultimoA(DEPOSITARIO)?.text), /Despachado/)
    assert.match(String(ultimoA(INGENIERO)?.text), /fue despachado/)
  })

  for (const [tipo, movimiento, destino] of [
    ['traspaso', 'transferencia', UB_OBRA_B],
    ['devolucion', 'retorno_garantia', UB_DEVOLUCIONES],
    ['deterioro', 'retorno_merma', UB_BAJAS],
  ] as const) {
    it(`${tipo}: el stock sale hacia su destino con la foto`, async () => {
      await pedirYEnviar(tipo)
      await pulsar(DEPOSITARIO, `rq:dk:${requerimiento().id}`, 'Dora')
      await manejarFotoRequerimientoSalida({ supabase: sb(), chatId: DEPOSITARIO, ...foto })

      const trf = db.tablas.transferencias_inventario[0]
      assert.equal(requerimiento().estado, 'despachado')
      assert.equal(trf.tipo_movimiento, movimiento)
      assert.equal(trf.destino_ubicacion_id, destino)
      assert.equal(trf.estado, 'completado')
      assert.equal((trf.fotos as unknown[]).length, 1)
      assert.match(String(trf.observaciones), /RS-/)
    })
  }

  it('una segunda foto no vuelve a despachar', async () => {
    await pedirYEnviar('deterioro')
    await pulsar(DEPOSITARIO, `rq:dk:${requerimiento().id}`, 'Dora')
    await manejarFotoRequerimientoSalida({ supabase: sb(), chatId: DEPOSITARIO, ...foto })

    const otraVez = await manejarFotoRequerimientoSalida({ supabase: sb(), chatId: DEPOSITARIO, ...foto })
    assert.equal(otraVez, false)
    assert.equal(db.tablas.transferencias_inventario.length, 1)
  })

  it('si Telegram reenvía la misma foto a la vez, solo se descuenta una', async () => {
    await pedirYEnviar('deterioro')
    await pulsar(DEPOSITARIO, `rq:dk:${requerimiento().id}`, 'Dora')
    const r = await obtenerRequerimientoSalida(sb(), String(requerimiento().id))
    assert.ok(r)
    const evidencia = { storage_path: 'x/1.jpg', url: 'https://x/1.jpg' }

    const [a, b] = await Promise.all([
      despacharRequerimientoSalida(sb(), { requerimiento: r, foto: evidencia, nombreObra: 'Obra Norte' }),
      despacharRequerimientoSalida(sb(), { requerimiento: r, foto: evidencia, nombreObra: 'Obra Norte' }),
    ])
    assert.deepEqual([a.ok, b.ok].sort(), [false, true])
    assert.equal(db.tablas.transferencias_inventario.length, 1)
  })

  it('si falla el movimiento (ya no hay stock), sigue a su nombre y no se marca despachado', async () => {
    await pedirYEnviar('uso')
    await pulsar(DEPOSITARIO, `rq:dk:${requerimiento().id}`, 'Dora')
    db.tablas.inventario_stock[0].cantidad_disponible = 1
    telegram.enviados.length = 0

    await manejarFotoRequerimientoSalida({ supabase: sb(), chatId: DEPOSITARIO, ...foto })

    assert.equal(requerimiento().estado, 'en_despacho')
    assert.equal(requerimiento().despachado_at ?? null, null)
    assert.match(String(ultimoA(DEPOSITARIO)?.text), /No se pudo despachar/)
    assert.match(String(ultimoA(DEPOSITARIO)?.text), /Stock insuficiente/)
    assert.equal(mensajesA(INGENIERO).length, 0)
  })

  it('una foto de alguien sin despacho a su nombre no se toma', async () => {
    await pedirYEnviar('uso')
    const manejado = await manejarFotoRequerimientoSalida({ supabase: sb(), chatId: DEPOSITARIO, ...foto })
    assert.equal(manejado, false)
    assert.equal(db.subidas.length, 0)
  })

  it('el almacén puede rechazar con un motivo y se avisa a quien pidió', async () => {
    await pedirYEnviar('uso')
    const id = requerimiento().id
    await pulsar(DEPOSITARIO, `rq:rj:${id}`, 'Dora')
    assert.equal(botonesDe(ultimoA(DEPOSITARIO)).length, 4)
    assert.equal(requerimiento().estado, 'solicitado')

    await pulsar(DEPOSITARIO, `rq:rm:${id}:0`, 'Dora')
    assert.equal(requerimiento().estado, 'rechazado')
    assert.equal(requerimiento().motivo_rechazo, 'No hay esa cantidad en el almacén')
    assert.match(String(ultimoA(INGENIERO)?.text), /rechazó su pedido/)
    assert.match(String(ultimoA(INGENIERO)?.text), /No hay esa cantidad en el almacén/)

    telegram.enviados.length = 0
    await pulsar(DEPOSITARIO, `rq:dk:${id}`, 'Dora')
    assert.match(String(alertas()[0].text), /ya fue rechazado/)
  })

  it('quien lo tomó puede soltarlo y vuelve a ofrecerse', async () => {
    await pedirYEnviar('uso')
    const id = requerimiento().id
    await pulsar(DEPOSITARIO, `rq:dk:${id}`, 'Dora')
    telegram.enviados.length = 0

    await pulsar(DEPOSITARIO, `rq:sl:${id}`, 'Dora')
    assert.equal(requerimiento().estado, 'solicitado')
    assert.equal(requerimiento().despachador_chat_id, null)
    assert.match(String(ultimoA(DEPOSITARIO)?.text), /disponible de nuevo/)
  })

  it('cancelar antes de enviar no crea nada', async () => {
    await armarPedido('uso')
    await pulsar(INGENIERO, 'rq:x')
    assert.equal(requerimiento(), undefined)
    assert.equal(sesion()?.contexto, 'menu')
  })
})
