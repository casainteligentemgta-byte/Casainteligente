import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import { depositarioVirtualObra, encargadosAlmacenObra } from '../almacen/depositariosNomina'
import { filtrarFacturasPorObras, type FacturaPendienteIngreso } from '../almacen/listarFacturasPendientesIngreso'
import { tecladoAprobacionDepartamento } from '../compras/aprobacionDepartamentoTelegram'
import { despachoTomadoPor } from '../telegram/despachoProcuraTelegram'
import { procuraSinFondos } from './compraACredito'
import { mensajeOrdenCompraComprador } from './emitirOrdenCompraProcura'
import { construirMensajePmDecisionProcura } from './mensajeAlertaProcuraTelegram'
import { estadoProcuraTrasIngreso, mensajeMaterialEnAlmacen } from './procuraRecibidaTrasIngreso'
import { construirMensajeTicketProcuraSolicitante } from './ticketProcuraSolicitanteTelegram'

const OBRA = 'obra-1'

function nomina(filas: Array<{ rol: string; nombre: string; chat: number | null }>) {
  return filas.map((f, i) => ({
    id: `n${i}`,
    proyecto_id: OBRA,
    empleado_id: null,
    categoria: 'empleado',
    rol: f.rol,
    nombre: f.nombre,
    telegram_chat_id: f.chat,
    activo: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }))
}

describe('depositario virtual', () => {
  it('con depositario en la nómina, el almacén lo atiende él', async () => {
    const db = crearFakeSupabase({
      ci_proyecto_nomina: nomina([
        { rol: 'depositario', nombre: 'Pedro', chat: 11 },
        { rol: 'admin', nombre: 'Luis', chat: 22 },
      ]),
    })
    const r = await encargadosAlmacenObra(db as unknown as SupabaseClient, OBRA)
    assert.equal(r.virtual, false)
    assert.deepEqual(r.personas.map((p) => p.chatId), ['11'])
  })

  it('sin depositario, lo atiende quien administra la obra', async () => {
    const db = crearFakeSupabase({
      ci_proyecto_nomina: nomina([
        { rol: 'admin', nombre: 'Luis', chat: 22 },
        { rol: 'comprador', nombre: 'Neo', chat: 33 },
        { rol: 'pm_obra', nombre: 'Carla', chat: 44 },
      ]),
    })
    const r = await encargadosAlmacenObra(db as unknown as SupabaseClient, OBRA)
    assert.equal(r.virtual, true)
    assert.deepEqual(r.personas.map((p) => p.chatId), ['22'])
  })

  it('obra sin nómina: los administradores del sistema', async () => {
    const db = crearFakeSupabase({
      ci_proyecto_nomina: [],
      ci_usuarios_sistema_telegram: [
        { nombre: 'Luis', telegram_id: 22, rol: 'Administrador', activo: true },
        { nombre: 'Neo', telegram_id: 33, rol: 'Comprador', activo: true },
        { nombre: 'Viejo', telegram_id: 55, rol: 'Administrador', activo: false },
      ],
    })
    const personas = await depositarioVirtualObra(db as unknown as SupabaseClient, OBRA)
    assert.deepEqual(personas.map((p) => p.chatId), ['22'])
  })
})

describe('sin fondos: el PM aprueba la compra a crédito', () => {
  const fila = {
    id: 'p1',
    ticket: 'PR-2026-00001',
    estado: 'pendiente_pm',
    solicitante_nombre: 'Ing. Ana',
    solicitante_telegram_chat_id: 1,
    material_txt: 'Cemento gris',
    material_id: 'm1',
    cantidad: 50,
    unidad: 'SACO',
    observaciones: null,
    prioridad: 'Media',
    monto_estimado_usd: null,
    viabilidad_informada_por: 'Contadora',
  }

  it('reconoce la solicitud sin fondos', () => {
    assert.equal(procuraSinFondos({ viabilidad_presupuestaria: 'no' }), true)
    assert.equal(procuraSinFondos({ viabilidad_presupuestaria: 'NO ' }), true)
    assert.equal(procuraSinFondos({ viabilidad_presupuestaria: 'si' }), false)
    assert.equal(procuraSinFondos(null), false)
  })

  it('al PM se le advierte y el botón dice «Aprobar a crédito»', () => {
    const sinFondos = construirMensajePmDecisionProcura(
      { ...fila, viabilidad_presupuestaria: 'no' } as never,
      'Media',
    )
    assert.match(sinFondos, /Sin fondos disponibles/)
    assert.match(sinFondos, /a crédito/)
    const conFondos = construirMensajePmDecisionProcura(
      { ...fila, viabilidad_presupuestaria: 'si' } as never,
      'Media',
    )
    assert.doesNotMatch(conFondos, /crédito/)

    const botones = (t: ReturnType<typeof tecladoAprobacionDepartamento>) =>
      t.inline_keyboard.flat().map((b) => b.text)
    assert.deepEqual(botones(tecladoAprobacionDepartamento('p1', { aCredito: true })), [
      '🟢 Aprobar a crédito',
      '🔴 Rechazar',
    ])
    assert.deepEqual(botones(tecladoAprobacionDepartamento('p1')), ['🟢 Aprobar', '🔴 Rechazar'])
  })

  it('la orden al comprador dice que es a crédito', () => {
    const base = { ...fila, estado: 'aprobada' }
    const credito = mensajeOrdenCompraComprador({ ...base, viabilidad_presupuestaria: 'no' } as never, {
      autorNombre: 'PM Carla',
    })
    assert.match(credito, /Compra a crédito/)
    const contado = mensajeOrdenCompraComprador({ ...base, viabilidad_presupuestaria: 'si' } as never, {
      autorNombre: 'PM Carla',
    })
    assert.doesNotMatch(contado, /crédito/)
  })

  it('el ticket del ingeniero dice «aprobada a crédito»', () => {
    const texto = construirMensajeTicketProcuraSolicitante(
      { ...fila, estado: 'aprobada', viabilidad_presupuestaria: 'no' } as never,
      [{ estado_anterior: 'pendiente_pm', estado_nuevo: 'aprobada', usuario: 'PM Carla' }],
    )
    assert.match(texto, /sin disponibilidad/)
    assert.match(texto, /aprobada <b>a crédito<\/b> \(PM Carla\)/)
  })
})

describe('material recibido en el almacén', () => {
  const procura = { material_id: 'm1', cantidad: 150, cantidad_compra: 50 }

  it('si llegó todo lo comprado, la solicitud queda recibida', () => {
    assert.deepEqual(estadoProcuraTrasIngreso(procura, [{ material_id: 'm1', cantidad: 50 }]), {
      estado: 'recibida',
      esperado: 50,
      recibido: 50,
    })
  })

  it('si llegó menos, queda recibida en parte', () => {
    const r = estadoProcuraTrasIngreso(procura, [{ material_id: 'm1', cantidad: 30 }])
    assert.equal(r.estado, 'recibida_parcial')
    assert.equal(r.recibido, 30)
  })

  it('sin conteo (ingreso por la web) se da por recibida', () => {
    assert.equal(estadoProcuraTrasIngreso(procura).estado, 'recibida')
    assert.equal(estadoProcuraTrasIngreso(procura, [{ material_id: 'otro', cantidad: 1 }]).estado, 'recibida')
  })

  it('el aviso al ingeniero dice cuánto llegó y cómo pedirlo', () => {
    const completo = mensajeMaterialEnAlmacen({
      ticket: 'PR-2026-00001',
      materialTxt: 'Cemento gris',
      unidad: 'SACO',
      esperado: 50,
      recibido: 50,
      completa: true,
      almacen: 'Almacén obra',
      numeroFactura: 'F-1',
    })
    assert.match(completo, /ya está en el almacén/)
    assert.match(completo, /50 SACO/)
    assert.match(completo, /Pedir material/)
    assert.doesNotMatch(completo, /Faltan/)

    const parcial = mensajeMaterialEnAlmacen({
      ticket: 'PR-2026-00001',
      materialTxt: 'Cemento gris',
      unidad: 'SACO',
      esperado: 50,
      recibido: 30,
      completa: false,
      almacen: null,
      numeroFactura: null,
    })
    assert.match(parcial, /una parte/)
    assert.match(parcial, /Faltan <b>20 SACO<\/b>/)
  })

  it('el ticket del ingeniero muestra el despacho y la llegada', () => {
    const texto = construirMensajeTicketProcuraSolicitante(
      {
        id: 'p1',
        ticket: 'PR-2026-00001',
        material_txt: 'Cemento gris',
        cantidad: 150,
        unidad: 'SACO',
        estado: 'recibida',
        cantidad_compra: 50,
        abastecimiento_codigo_despacho: 'SAL-9',
      },
      [{ estado_anterior: 'en_compra', estado_nuevo: 'recibida', motivo: 'Compra recibida en almacén (factura #F-1)' }],
    )
    assert.match(texto, /Despacho almacén: SAL-9/)
    assert.match(texto, /Orden enviada al comprador/)
    assert.match(texto, /Compra recibida en el almacén/)
  })
})

describe('despacho de una solicitud: quién lo tiene tomado', () => {
  const ahora = new Date('2026-10-10T12:00:00Z')

  it('recién tomado, es de quien lo tomó', () => {
    assert.equal(despachoTomadoPor({ despacho_chat_id: 77, despacho_tomado_at: '2026-10-10T11:50:00Z' }, ahora), '77')
  })

  it('pasada media hora sin foto, queda libre', () => {
    assert.equal(despachoTomadoPor({ despacho_chat_id: 77, despacho_tomado_at: '2026-10-10T11:20:00Z' }, ahora), null)
  })

  it('sin tomar, está libre', () => {
    assert.equal(despachoTomadoPor({ despacho_chat_id: null, despacho_tomado_at: null }, ahora), null)
  })
})

describe('/ingreso: cada quien ve las facturas de su obra', () => {
  const f = (key: string, proyecto: string | null, chat: string | null = null): FacturaPendienteIngreso => ({
    key,
    origen: 'telegram',
    origenLabel: '📱 Telegram',
    invoice_number: key,
    supplier_name: 'Proveedor',
    fecha: null,
    estado: 'confirmado',
    accion: 'ingreso_almacen',
    pendienteId: key,
    purchase_invoice_id: null,
    proyecto_id: proyecto,
    chat_id: chat,
  })
  const facturas = [f('a', 'obra-1'), f('b', 'obra-2'), f('c', null, '500'), f('d', null, '900')]

  it('el depositario de una obra solo ve las de esa obra', () => {
    assert.deepEqual(
      filtrarFacturasPorObras(facturas, new Set(['obra-1']), '700').map((x) => x.key),
      ['a'],
    )
  })

  it('una factura sin obra la ve solo quien la cargó', () => {
    assert.deepEqual(
      filtrarFacturasPorObras(facturas, new Set(['obra-2']), '500').map((x) => x.key),
      ['b', 'c'],
    )
  })

  it('quien no tiene obra no ve ninguna; el administrador las ve todas', () => {
    assert.deepEqual(filtrarFacturasPorObras(facturas, new Set(), '700'), [])
    assert.equal(filtrarFacturasPorObras(facturas, 'todas', '700').length, 4)
  })
})
