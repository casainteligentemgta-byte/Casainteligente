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
import {
  avisarRetiroCompraPendiente,
  cerrarRetiroCompraTrasIngreso,
  manejarCallbackRetiroCompra,
  manejarFotoRetiroCompra,
} from './retiroCompraTelegram'

const OBRA = '11111111-1111-4111-8111-111111111111'
const ALMACEN = '22222222-2222-4222-8222-222222222222'
const FACTURA = '33333333-3333-4333-8333-333333333333'
const PROCURA = '44444444-4444-4444-8444-444444444444'

const COMPRADOR = '300'
const LOGISTICA = '500'
const DEPOSITARIO = '900'

function baseDeDatos(opts: { conLogistica?: boolean } = {}): FakeSupabase {
  return crearFakeSupabase({
    ci_proyectos: [
      { id: OBRA, nombre: 'Obra Norte', depositario_id: 'emp-dep', telegram_grupo_almacen_id: null },
    ],
    inv_ubicaciones: [{ id: ALMACEN, nombre: 'Almacén Obra Norte', ci_proyecto_id: OBRA }],
    ci_empleados: [{ id: 'emp-dep', telegram_chat_id: 900, nombre_completo: 'Dora Depósito' }],
    ci_procuras: [{ id: PROCURA, ticket: 'PR-2026-00099' }],
    ci_proyecto_nomina:
      opts.conLogistica === false
        ? []
        : [
            {
              id: 'nom-1',
              proyecto_id: OBRA,
              categoria: 'empleado',
              rol: 'logistica',
              activo: true,
              telegram_chat_id: 500,
              nombre: 'Luis Chofer',
            },
          ],
    ci_telegram_estados: [],
  })
}

const compra = {
  purchaseInvoiceId: FACTURA,
  procuraId: PROCURA,
  proyectoId: OBRA,
  ubicacionDestinoId: ALMACEN,
  numeroFactura: 'A-778',
  proveedorNombre: 'Ferretería El Tornillo',
  solicitadoPorChatId: COMPRADOR,
}

const foto = { buffer: Buffer.from('jpg'), mimeType: 'image/jpeg', ext: 'jpg' }

describe('retiro de mercancía comprada', () => {
  let telegram: ReturnType<typeof capturarTelegram>
  let db: FakeSupabase
  const sb = () => db as unknown as SupabaseClient

  const retiro = () => db.tablas.ci_compras_retiros[0]
  const mensajesA = (chat: string): MensajeTelegramCapturado[] =>
    telegram.enviados.filter((m) => m.metodo === 'sendMessage' && String(m.chat_id) === chat)
  const alertas = () => telegram.enviados.filter((m) => m.metodo === 'answerCallbackQuery')

  async function pulsar(chat: string, accion: 'tk' | 'lb', nombre = 'Luis') {
    await manejarCallbackRetiroCompra(sb(), {
      chatId: chat,
      callbackId: 'cb',
      data: `rt:${accion}:${retiro().id}`,
      nombre,
    })
  }

  beforeEach(() => {
    telegram = capturarTelegram()
    db = baseDeDatos()
  })
  afterEach(() => telegram.restaurar())

  it('al confirmarse la factura avisa a Logística de la obra y al comprador', async () => {
    const r = await avisarRetiroCompraPendiente(sb(), compra)

    assert.deepEqual(r, { ok: true, avisados: 2 })
    assert.equal(retiro().estado, 'pendiente')
    for (const chat of [LOGISTICA, COMPRADOR]) {
      const [m] = mensajesA(chat)
      assert.match(String(m.text), /Mercancía por retirar/)
      assert.match(String(m.text), /A-778/)
      assert.match(String(m.text), /PR-2026-00099/)
      assert.match(String(m.text), /Almacén Obra Norte/)
      assert.deepEqual(botonesDe(m), ['🚚 La retiro yo'])
    }
    assert.equal(mensajesA(DEPOSITARIO).length, 0)
  })

  it('no repite el aviso si la factura ya tenía retiro', async () => {
    await avisarRetiroCompraPendiente(sb(), compra)
    const antes = telegram.enviados.length
    const r = await avisarRetiroCompraPendiente(sb(), compra)

    assert.equal(r.motivo, 'ya_existia')
    assert.equal(telegram.enviados.length, antes)
    assert.equal(db.tablas.ci_compras_retiros.length, 1)
  })

  it('sin la migración 341 no avisa ni falla', async () => {
    db = crearFakeSupabase(baseDeDatos().tablas, { tablasAusentes: ['ci_compras_retiros'] })
    const r = await avisarRetiroCompraPendiente(sb(), compra)

    assert.deepEqual(r, { ok: false, avisados: 0, motivo: 'sin_migracion' })
    assert.equal(telegram.enviados.length, 0)
  })

  it('si la obra no tiene Logística, solo avisa al comprador y se lo dice', async () => {
    db = baseDeDatos({ conLogistica: false })
    const r = await avisarRetiroCompraPendiente(sb(), compra)

    assert.equal(r.avisados, 1)
    assert.match(String(mensajesA(COMPRADOR)[0].text), /no tiene personal de Logística/)
  })

  it('el primero que pulsa queda asignado; el segundo recibe quién lo tomó', async () => {
    await avisarRetiroCompraPendiente(sb(), compra)
    telegram.enviados.length = 0

    await pulsar(LOGISTICA, 'tk')
    assert.equal(retiro().estado, 'asignado')
    assert.equal(retiro().transportista_chat_id, 500)
    assert.equal(retiro().transportista_nombre, 'Luis Chofer')
    const pedido = mensajesA(LOGISTICA).at(-1)
    assert.match(String(pedido?.text), /foto de lo que retira/)
    assert.deepEqual(botonesDe(pedido), ['↩️ No puedo retirarla'])
    assert.match(String(mensajesA(COMPRADOR).at(-1)?.text), /Luis Chofer<\/b> retirará/)

    telegram.enviados.length = 0
    await pulsar(COMPRADOR, 'tk', 'Carla')
    assert.equal(retiro().transportista_chat_id, 500)
    assert.equal(alertas()[0].show_alert, true)
    assert.match(String(alertas()[0].text), /Ya lo tomó Luis Chofer/)
  })

  it('con la foto pasa a «en camino» y avisa al almacén y al comprador', async () => {
    await avisarRetiroCompraPendiente(sb(), compra)
    await pulsar(LOGISTICA, 'tk')
    telegram.enviados.length = 0

    const manejado = await manejarFotoRetiroCompra({ supabase: sb(), chatId: LOGISTICA, ...foto })

    assert.equal(manejado, true)
    assert.equal(retiro().estado, 'en_camino')
    assert.equal((retiro().fotos as unknown[]).length, 1)
    assert.match(db.subidas[0], new RegExp(`^procurement-documents/retiros-compra/${retiro().id}/`))
    assert.match(String(mensajesA(LOGISTICA)[0].text), /Retiro registrado con foto/)
    const almacen = mensajesA(DEPOSITARIO)[0]
    assert.match(String(almacen.text), /en camino al almacén/)
    assert.match(String(almacen.text), /La trae: <b>Luis Chofer/)
    assert.match(String(almacen.text), /\/ingreso/)
    assert.match(String(mensajesA(COMPRADOR)[0].text), /va en camino/)
  })

  it('una foto de alguien sin retiro a su nombre no se toma', async () => {
    await avisarRetiroCompraPendiente(sb(), compra)
    const manejado = await manejarFotoRetiroCompra({ supabase: sb(), chatId: LOGISTICA, ...foto })

    assert.equal(manejado, false)
    assert.equal(db.subidas.length, 0)
    assert.equal(retiro().estado, 'pendiente')
  })

  it('si la foto no se puede guardar, el retiro sigue esperándola', async () => {
    await avisarRetiroCompraPendiente(sb(), compra)
    await pulsar(LOGISTICA, 'tk')
    db = crearFakeSupabase(db.tablas, { storageCaido: true })
    telegram.enviados.length = 0

    await manejarFotoRetiroCompra({ supabase: sb(), chatId: LOGISTICA, ...foto })

    assert.equal(retiro().estado, 'asignado')
    assert.match(String(mensajesA(LOGISTICA)[0].text), /No se pudo guardar/)
    assert.equal(mensajesA(DEPOSITARIO).length, 0)
  })

  it('quien lo tomó puede liberarlo y se vuelve a ofrecer', async () => {
    await avisarRetiroCompraPendiente(sb(), compra)
    await pulsar(LOGISTICA, 'tk')
    telegram.enviados.length = 0

    await pulsar(COMPRADOR, 'lb', 'Carla')
    assert.equal(retiro().estado, 'asignado')
    assert.equal(alertas()[0].show_alert, true)

    telegram.enviados.length = 0
    await pulsar(LOGISTICA, 'lb')
    assert.equal(retiro().estado, 'pendiente')
    assert.equal(retiro().transportista_chat_id, null)
    const reoferta = mensajesA(COMPRADOR).at(-1)
    assert.match(String(reoferta?.text), /Retiro disponible de nuevo/)
    assert.deepEqual(botonesDe(reoferta), ['🚚 La retiro yo'])
  })

  it('el ingreso en almacén cierra el retiro y avisa a quien la traía', async () => {
    await avisarRetiroCompraPendiente(sb(), compra)
    await pulsar(LOGISTICA, 'tk')
    await manejarFotoRetiroCompra({ supabase: sb(), chatId: LOGISTICA, ...foto })
    telegram.enviados.length = 0

    await cerrarRetiroCompraTrasIngreso(sb(), FACTURA)
    assert.equal(retiro().estado, 'entregado')
    assert.ok(retiro().entregado_at)
    assert.match(String(mensajesA(LOGISTICA)[0].text), /El almacén recibió la factura/)

    telegram.enviados.length = 0
    await cerrarRetiroCompraTrasIngreso(sb(), FACTURA)
    assert.equal(telegram.enviados.length, 0)
  })

  it('después de recibida ya no se puede tomar', async () => {
    await avisarRetiroCompraPendiente(sb(), compra)
    await cerrarRetiroCompraTrasIngreso(sb(), FACTURA)
    telegram.enviados.length = 0

    await pulsar(LOGISTICA, 'tk')
    assert.equal(retiro().estado, 'entregado')
    assert.match(String(alertas()[0].text), /ya fue recibida en almacén/)
  })

  it('cerrar una factura sin retiro (o sin migración) no hace nada', async () => {
    await cerrarRetiroCompraTrasIngreso(sb(), FACTURA)
    db = crearFakeSupabase(baseDeDatos().tablas, { tablasAusentes: ['ci_compras_retiros'] })
    await cerrarRetiroCompraTrasIngreso(sb(), FACTURA)
    assert.equal(telegram.enviados.length, 0)
  })
})
