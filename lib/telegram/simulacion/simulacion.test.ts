import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase, type FakeSupabase } from '../testing/fakeSupabase'
import { answerCallbackQuery, downloadTelegramFile, getTelegramBotToken, sendTelegramMessage } from '../botApi'
import { enSimulacionBot, simulacionBotActiva } from './contexto'
import { BotDeEnsayo, ErrorDeEnsayo, leerGuion, sinFormato } from './botDeEnsayo'
import { isChatAllowedAsync } from '../chatWhitelist'
import { listarUsuariosOrdenCompraTelegram, obtenerUsuarioSistemaTelegram } from '../../compras/usuariosSistemaTelegram'
import {
  listarAprobadoresProcuraTelegram,
  listarContadoresProcuraTelegram,
  listarProjectManagersProcuraTelegram,
} from '../../procuras/aprobadoresProcuraTelegram'
import {
  ALMACEN_ENSAYO,
  MATERIAL_ENSAYO_1,
  MATERIAL_ENSAYO_2,
  OBRA_ENSAYO,
  OBRA_ENSAYO_2,
  PERSONAS_ENSAYO,
  cargarObraDeEnsayo,
  esChatDeEnsayo,
  referenciaReal,
  reiniciarObraDeEnsayo,
  usuariosSistemaDeEnsayo,
  uuidsEn,
} from './obraDeEnsayo'

const OBRA_REAL = '171694ed-0ecb-4ec5-82f5-82b980cb261f'
const ALMACEN_REAL = 'cd876d5b-94bf-445e-9061-f78b6623d460'
const UB_OBRA_1 = '55615cd2-364e-4744-88ac-130078c12441'
const UB_OBRA_2 = 'b59c09e5-753f-4a80-a640-22e22daa2610'
const DEPO = String(PERSONAS_ENSAYO.depo.chatId)

function base(extra: Record<string, Array<Record<string, unknown>>> = {}): FakeSupabase {
  return crearFakeSupabase({
    ci_proyectos: [
      { id: OBRA_ENSAYO.id, nombre: OBRA_ENSAYO.nombre },
      { id: OBRA_ENSAYO_2.id, nombre: OBRA_ENSAYO_2.nombre },
      { id: OBRA_REAL, nombre: 'RANCHO FLAMBOYANT' },
    ],
    inv_ubicaciones: [
      { id: ALMACEN_ENSAYO.id, nombre: ALMACEN_ENSAYO.nombre, tipo: 'almacen_central', ci_proyecto_id: OBRA_ENSAYO.id },
      { id: UB_OBRA_1, nombre: OBRA_ENSAYO.nombre, tipo: 'obra', ci_proyecto_id: OBRA_ENSAYO.id },
      { id: UB_OBRA_2, nombre: OBRA_ENSAYO_2.nombre, tipo: 'obra', ci_proyecto_id: OBRA_ENSAYO_2.id },
      { id: ALMACEN_REAL, nombre: 'RANCHO FLAMBOYANT', tipo: 'almacen_central', ci_proyecto_id: OBRA_REAL },
      { id: 'de4c3389-1fb1-4938-8b0f-221af4cf8fd0', nombre: 'Devoluciones', tipo: 'garantias', ci_proyecto_id: null },
    ],
    ci_telegram_estados: [],
    ...extra,
  })
}

const sb = (db: FakeSupabase) => db as unknown as SupabaseClient

describe('Telegram en modo captura', () => {
  it('fuera de un ensayo no hay simulación y el token es el real', () => {
    const previo = process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_BOT_TOKEN
    assert.equal(simulacionBotActiva(), undefined)
    assert.equal(getTelegramBotToken(), null)
    if (previo !== undefined) process.env.TELEGRAM_BOT_TOKEN = previo
  })

  it('dentro de un ensayo los mensajes se capturan y no salen a la red', async () => {
    const fetchReal = globalThis.fetch
    let llamadasDeRed = 0
    globalThis.fetch = (async () => {
      llamadasDeRed += 1
      throw new Error('un ensayo no debe salir a la red')
    }) as typeof fetch

    try {
      const { envios } = await enSimulacionBot(async () => {
        assert.equal(getTelegramBotToken(), 'SIMULACION')
        await sendTelegramMessage(123, '<b>Hola</b> &amp; adiós', {
          parse_mode: 'HTML',
          skipLogEspejo: true,
          reply_markup: { inline_keyboard: [[{ text: '✅ Sí', callback_data: 'x:si' }], [{ text: 'Web', url: 'https://a.test' }]] },
        })
        await answerCallbackQuery('cb1', 'Falta la foto', true)
        const archivo = await downloadTelegramFile('cualquier-id')
        assert.equal(archivo.filePath, 'photos/ensayo.jpg')
        // Cabecera de un JPEG de verdad: el bot la sube a Storage como cualquier foto.
        assert.deepEqual([archivo.buffer[0], archivo.buffer[1]], [0xff, 0xd8])
      })

      assert.equal(llamadasDeRed, 0)
      assert.equal(envios.length, 2)
      assert.equal(envios[0].metodo, 'sendMessage')
      assert.equal(envios[0].chatId, '123')
      assert.equal(sinFormato(envios[0].texto), 'Hola & adiós')
      assert.deepEqual(envios[0].botones, [
        { texto: '✅ Sí', data: 'x:si', url: null },
        { texto: 'Web', data: null, url: 'https://a.test' },
      ])
      assert.equal(envios[1].metodo, 'answerCallbackQuery')
      assert.equal(envios[1].alerta, true)
    } finally {
      globalThis.fetch = fetchReal
    }
  })

  it('dos ensayos a la vez no mezclan sus mensajes', async () => {
    const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const [a, b] = await Promise.all([
      enSimulacionBot(async () => {
        await sendTelegramMessage(1, 'A1', { skipLogEspejo: true })
        await pausa(15)
        await sendTelegramMessage(1, 'A2', { skipLogEspejo: true })
      }),
      enSimulacionBot(async () => {
        await pausa(5)
        await sendTelegramMessage(2, 'B1', { skipLogEspejo: true })
      }),
    ])
    assert.deepEqual(a.envios.map((e) => e.texto), ['A1', 'A2'])
    assert.deepEqual(b.envios.map((e) => e.texto), ['B1'])
    assert.equal(simulacionBotActiva(), undefined)
  })
})

describe('la obra de ensayo no deja tocar obras reales', () => {
  it('reconoce sus chats y extrae identificadores', () => {
    assert.equal(esChatDeEnsayo(PERSONAS_ENSAYO.ing.chatId), true)
    assert.equal(esChatDeEnsayo(267515133), false)
    assert.deepEqual(uuidsEn(`sg:x:${OBRA_REAL} y ${OBRA_REAL.toUpperCase()}`), [OBRA_REAL])
    assert.deepEqual(uuidsEn('se:mas:no'), [])
  })

  it('carga la obra de ensayo con sus ubicaciones', async () => {
    const obra = await cargarObraDeEnsayo(sb(base()))
    assert.equal(obra.ubicacionObra1, UB_OBRA_1)
    assert.equal(obra.ubicacionObra2, UB_OBRA_2)
    assert.equal(obra.ubicaciones.length, 3)
  })

  it('se niega si esos identificadores ya no son la obra ficticia', async () => {
    const db = base()
    db.tablas.ci_proyectos[0].nombre = 'Edificio Mirador'
    await assert.rejects(() => cargarObraDeEnsayo(sb(db)), /ya no es la obra de ensayo/)
  })

  it('se niega si falta la obra de ensayo', async () => {
    const db = base()
    db.tablas.ci_proyectos.splice(1, 1)
    await assert.rejects(() => cargarObraDeEnsayo(sb(db)), /Falta la obra de ensayo/)
  })

  it('distingue obra y almacén reales de los de ensayo y de las ubicaciones compartidas', async () => {
    const db = base()
    const obra = await cargarObraDeEnsayo(sb(db))
    assert.equal(await referenciaReal(sb(db), obra, [OBRA_ENSAYO.id, ALMACEN_ENSAYO.id, UB_OBRA_2]), null)
    assert.match(String(await referenciaReal(sb(db), obra, [OBRA_REAL])), /obra real «RANCHO FLAMBOYANT»/)
    assert.match(String(await referenciaReal(sb(db), obra, [ALMACEN_REAL])), /ubicación real/)
    // Devoluciones y bajas no pertenecen a ninguna obra: las usan todas.
    assert.equal(await referenciaReal(sb(db), obra, ['de4c3389-1fb1-4938-8b0f-221af4cf8fd0']), null)
    // Un identificador que no es obra ni ubicación (un material, un pedido) no bloquea.
    assert.equal(await referenciaReal(sb(db), obra, [MATERIAL_ENSAYO_1.id]), null)
  })

  it('reiniciar borra solo lo de ensayo y repone el stock inicial', async () => {
    const db = base({
      ci_telegram_estados: [
        { chat_id: DEPO, contexto: 'salida_obra' },
        { chat_id: '267515133', contexto: 'factura' },
      ],
      inv_egresos_campo: [
        { id: 'e-ensayo', proyecto_id: OBRA_ENSAYO.id },
        { id: 'e-real', proyecto_id: OBRA_REAL },
      ],
      inv_egresos_campo_lineas: [
        { id: 'l1', egreso_id: 'e-ensayo' },
        { id: 'l2', egreso_id: 'e-real' },
      ],
      inv_requerimientos_salida: [
        { id: 'r1', proyecto_id: OBRA_ENSAYO.id },
        { id: 'r2', proyecto_id: OBRA_REAL },
      ],
      ci_obra_movimientos_material: [{ id: 'm1', proyecto_id: OBRA_REAL }],
      inv_movimientos: [
        { id: 'mv1', material_id: MATERIAL_ENSAYO_1.id },
        { id: 'mv2', material_id: 'mat-real' },
      ],
      transferencias_inventario: [
        { id: 't-ensayo', origen_ubicacion_id: ALMACEN_ENSAYO.id },
        { id: 't-real', origen_ubicacion_id: ALMACEN_REAL },
      ],
      transferencias_inventario_lineas: [
        { id: 'tl1', transferencia_id: 't-ensayo', material_id: MATERIAL_ENSAYO_1.id },
        { id: 'tl2', transferencia_id: 't-real', material_id: 'mat-real' },
      ],
      inventario_stock: [
        { ubicacion_id: ALMACEN_ENSAYO.id, material_id: MATERIAL_ENSAYO_1.id, cantidad_disponible: 3 },
        { ubicacion_id: UB_OBRA_1, material_id: MATERIAL_ENSAYO_1.id, cantidad_disponible: 97 },
        { ubicacion_id: ALMACEN_REAL, material_id: 'mat-real', cantidad_disponible: 10 },
      ],
    })
    db.subidas.push(
      `ci-proyectos-media/telegram-movimientos/${OBRA_ENSAYO.id}/salida/1.jpg`,
      `ci-proyectos-media/telegram-movimientos/${OBRA_ENSAYO.id}/requerimientos/abc/2.jpg`,
      `ci-proyectos-media/telegram-movimientos/traspasos/${DEPO}/3.jpg`,
      `ci-proyectos-media/telegram-movimientos/${OBRA_REAL}/salida/real.jpg`,
      'ci-proyectos-media/telegram-movimientos/traspasos/267515133/real.jpg',
    )
    const obra = await cargarObraDeEnsayo(sb(db))
    const pasos = await reiniciarObraDeEnsayo(sb(db), obra)

    assert.deepEqual(pasos.filter((p) => !p.ok), [])
    assert.deepEqual(db.subidas, [
      `ci-proyectos-media/telegram-movimientos/${OBRA_REAL}/salida/real.jpg`,
      'ci-proyectos-media/telegram-movimientos/traspasos/267515133/real.jpg',
    ])
    const ids = (tabla: string, col = 'id') => db.tablas[tabla].map((f) => f[col])
    assert.deepEqual(ids('ci_telegram_estados', 'chat_id'), ['267515133'])
    assert.deepEqual(ids('inv_egresos_campo'), ['e-real'])
    assert.deepEqual(ids('inv_egresos_campo_lineas'), ['l2'])
    assert.deepEqual(ids('inv_requerimientos_salida'), ['r2'])
    assert.deepEqual(ids('ci_obra_movimientos_material'), ['m1'])
    assert.deepEqual(ids('inv_movimientos'), ['mv2'])
    assert.deepEqual(ids('transferencias_inventario'), ['t-real'])
    assert.deepEqual(
      db.tablas.inventario_stock.map((f) => [f.ubicacion_id, f.material_id, f.cantidad_disponible]),
      [
        [ALMACEN_REAL, 'mat-real', 10],
        [ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id, 100],
        [ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_2.id, 50],
      ],
    )
  })
})

describe('bot de ensayo', () => {
  /** Bot de mentira: responde según lo que le llegue, usando la API real de envío. */
  async function conBot(
    db: FakeSupabase,
    responder: (update: Record<string, unknown>) => Promise<void>,
  ): Promise<{ bot: BotDeEnsayo; recibidos: Array<Record<string, unknown>> }> {
    const obra = await cargarObraDeEnsayo(sb(db))
    const recibidos: Array<Record<string, unknown>> = []
    const bot = new BotDeEnsayo(sb(db), obra, async (update) => {
      recibidos.push(update)
      await responder(update)
      return { ok: true }
    })
    return { bot, recibidos }
  }

  const teclado = (...botones: Array<[string, string]>) => ({
    skipLogEspejo: true,
    reply_markup: { inline_keyboard: botones.map(([text, callback_data]) => [{ text, callback_data }]) },
  })

  it('escribe, pulsa por texto del botón y manda fotos como lo haría Telegram', async () => {
    const { bot, recibidos } = await conBot(base(), async (u) => {
      const msg = u.message as { text?: string; photo?: unknown[] } | undefined
      if (msg?.text === '/salida') {
        await sendTelegramMessage(DEPO, 'Elige', teclado(['🏗 A un obrero en obra', 'sg:obra'], ['🔄 Traspaso', 'sg:prestamo']))
      } else if (u.callback_query) {
        await answerCallbackQuery('x')
        await sendTelegramMessage(DEPO, '<b>¿Quién recibe?</b>', { skipLogEspejo: true })
      } else if (msg?.photo) {
        await sendTelegramMessage(DEPO, '✅ Foto guardada', { skipLogEspejo: true })
      }
    })

    await bot.escribir('depo', '/salida')
    const p2 = await bot.pulsar('depo', 'obrero')
    await bot.foto('depo', 'Para la cerca')

    const cb = recibidos[1].callback_query as { data: string; from: { id: number }; message: { chat: { id: number } } }
    assert.equal(cb.data, 'sg:obra')
    assert.equal(cb.from.id, PERSONAS_ENSAYO.depo.chatId)
    assert.equal(cb.message.chat.id, PERSONAS_ENSAYO.depo.chatId)
    const foto = recibidos[2].message as { photo: unknown[]; caption: string }
    assert.equal(foto.photo.length, 2)
    assert.equal(foto.caption, 'Para la cerca')

    assert.equal(p2.accion, 'pulsa «🏗 A un obrero en obra»')
    assert.deepEqual(p2.respuestas.map((r) => [r.para, r.tipo, r.texto]), [
      ['chat —', 'aviso', ''],
      ['Depo Ensayo', 'mensaje', '¿Quién recibe?'],
    ])
    assert.equal(bot.textoUltimoPaso(), '✅ Foto guardada')
    assert.equal(bot.pasos.length, 3)
  })

  it('prefiere el botón de nombre exacto sobre uno que solo lo contiene', async () => {
    const { bot, recibidos } = await conBot(base(), async (u) => {
      if ((u.message as { text?: string } | undefined)?.text) {
        await sendTelegramMessage(
          DEPO,
          'Obra',
          teclado([`${OBRA_ENSAYO.nombre} 2`, `p:${OBRA_ENSAYO_2.id}`], [OBRA_ENSAYO.nombre, `p:${OBRA_ENSAYO.id}`]),
        )
      }
    })
    await bot.escribir('depo', '/salida')
    await bot.pulsar('depo', OBRA_ENSAYO.nombre)
    assert.equal((recibidos[1].callback_query as { data: string }).data, `p:${OBRA_ENSAYO.id}`)
  })

  it('si la lista está paginada, avanza hasta encontrar el botón', async () => {
    const { bot, recibidos } = await conBot(base(), async (u) => {
      const data = (u.callback_query as { data?: string } | undefined)?.data
      if (data === 'pag:1') {
        await sendTelegramMessage(DEPO, 'Página 2', teclado([OBRA_ENSAYO.nombre, `p:${OBRA_ENSAYO.id}`], ['◀ Anterior', 'pag:0']))
      } else if (!data) {
        await sendTelegramMessage(DEPO, 'Página 1', teclado(['Otra obra', 'p:otra'], ['1 / 2', 'pag:0'], ['Siguiente ▶', 'pag:1']))
      }
    })
    await bot.escribir('depo', '/salida')
    await bot.pulsar('depo', OBRA_ENSAYO.nombre)
    assert.deepEqual(
      recibidos.slice(1).map((u) => (u.callback_query as { data: string }).data),
      ['pag:1', `p:${OBRA_ENSAYO.id}`],
    )
  })

  it('si el botón no existe, se detiene y dice cuáles hay', async () => {
    const { bot } = await conBot(base(), async () => {
      await sendTelegramMessage(DEPO, 'Elige', teclado(['Uno', 'a'], ['Dos', 'b']))
    })
    await bot.escribir('depo', '/salida')
    await assert.rejects(() => bot.pulsar('depo', 'Tres'), (e: Error) => {
      assert.ok(e instanceof ErrorDeEnsayo)
      assert.match(e.message, /No hay ningún botón con «Tres».*«Uno», «Dos»/)
      return true
    })
    assert.match(String(bot.pasos.at(-1)?.error), /Tres/)
  })

  it('no pulsa un botón que apunta a una obra real', async () => {
    const { bot, recibidos } = await conBot(base(), async () => {
      await sendTelegramMessage(DEPO, 'Obra', teclado(['RANCHO FLAMBOYANT', `p:${OBRA_REAL}`]))
    })
    await bot.escribir('depo', '/salida')
    await assert.rejects(() => bot.pulsar('depo', 'RANCHO'), /apunta a la obra real «RANCHO FLAMBOYANT»/)
    assert.equal(recibidos.length, 1)
  })

  it('si la sesión queda apuntando a un almacén real, la cierra y se detiene', async () => {
    const db = base()
    const { bot } = await conBot(db, async () => {
      db.tablas.ci_telegram_estados.push({
        chat_id: DEPO,
        contexto: 'salida_obra',
        proyecto_id: OBRA_ENSAYO.id,
        metadata: { flujo: 'egreso_v2', paso: 'obrero', origen_ubicacion_id: ALMACEN_REAL },
      })
    })
    await assert.rejects(() => bot.escribir('depo', 'algo'), /la sesión quedó apuntando a la ubicación real/)
    assert.equal(db.tablas.ci_telegram_estados[0].contexto, 'menu')
    assert.deepEqual(db.tablas.ci_telegram_estados[0].metadata, {})
  })

  it('anota la sesión del bot después de cada paso', async () => {
    const db = base()
    const { bot } = await conBot(db, async () => {
      db.tablas.ci_telegram_estados.push({
        chat_id: DEPO,
        contexto: 'salida_obra',
        proyecto_id: OBRA_ENSAYO.id,
        metadata: { flujo: 'egreso_v2', paso: 'obrero', origen_ubicacion_id: ALMACEN_ENSAYO.id },
      })
    })
    const paso = await bot.escribir('depo', '/salida')
    assert.deepEqual(paso.sesion, { contexto: 'salida_obra', flujo: 'egreso_v2', paso: 'obrero' })
    assert.equal(paso.error, undefined)
  })

  it('un fallo del bot queda anotado en el paso', async () => {
    const { bot } = await conBot(base(), async () => {
      throw new Error('column "x" does not exist')
    })
    await assert.rejects(() => bot.escribir('depo', '/salida'), /El bot falló: column "x" does not exist/)
    assert.match(String(bot.pasos[0].error), /column "x"/)
  })
})

describe('personas con rol en el departamento de compras', () => {
  const real = {
    id: 'u-neo',
    nombre: 'Neo Cardenas',
    telegram_id: 111,
    rol: 'Comprador',
    proyecto_id: OBRA_REAL,
    activo: true,
  }
  const db = () => base({ ci_usuarios_sistema_telegram: [real], ci_proyecto_nomina: [] })
  const simulados = usuariosSistemaDeEnsayo()

  it('las personas del ensayo tienen los cuatro roles de la cadena, atados a la obra ficticia', () => {
    assert.deepEqual(
      simulados.map((u) => [u.nombre, u.rol]),
      [
        ['Ing. Ensayo', 'Solicitante'],
        ['PM Ensayo', 'Aprobador'],
        ['Conta Ensayo', 'Contador'],
        ['Compra Ensayo', 'Comprador'],
      ],
    )
    assert.ok(simulados.every((u) => u.proyecto_id === OBRA_ENSAYO.id))
    // Nadie de la nómina de ensayo es «admin»: ese rol se copia como Administrador global.
    assert.ok(Object.values(PERSONAS_ENSAYO).every((p) => p.rol !== 'admin'))
  })

  it('fuera de un ensayo solo existen los usuarios reales', async () => {
    const d = db()
    assert.equal((await obtenerUsuarioSistemaTelegram(sb(d), 111))?.nombre, 'Neo Cardenas')
    assert.equal(await obtenerUsuarioSistemaTelegram(sb(d), PERSONAS_ENSAYO.compra.chatId), null)
    assert.deepEqual((await listarUsuariosOrdenCompraTelegram(sb(d))).map((u) => u.nombre), ['Neo Cardenas'])
    assert.deepEqual(await listarContadoresProcuraTelegram(sb(d), OBRA_REAL), [])
  })

  it('dentro de un ensayo solo existen las personas del ensayo', async () => {
    const d = db()
    await enSimulacionBot(
      async () => {
        assert.equal(await obtenerUsuarioSistemaTelegram(sb(d), 111), null)
        const compra = await obtenerUsuarioSistemaTelegram(sb(d), PERSONAS_ENSAYO.compra.chatId)
        assert.equal(compra?.rol, 'Comprador')
        assert.equal(compra?.activo, true)
        assert.equal(await obtenerUsuarioSistemaTelegram(sb(d), PERSONAS_ENSAYO.depo.chatId), null)

        assert.deepEqual((await listarUsuariosOrdenCompraTelegram(sb(d))).map((u) => u.nombre), ['Compra Ensayo'])
        assert.deepEqual(
          (await listarContadoresProcuraTelegram(sb(d), OBRA_ENSAYO.id)).map((c) => c.chatId),
          [PERSONAS_ENSAYO.conta.chatId],
        )
        assert.deepEqual(
          (await listarProjectManagersProcuraTelegram(sb(d), OBRA_ENSAYO.id)).map((c) => c.chatId),
          [PERSONAS_ENSAYO.pm.chatId],
        )
      },
      { usuariosSistema: simulados },
    )
  })

  it('un ensayo no copia a nadie de la nómina a la tabla real de usuarios', async () => {
    const d = db()
    d.tablas.ci_proyecto_nomina.push({
      id: PERSONAS_ENSAYO.pm.nominaId,
      proyecto_id: OBRA_ENSAYO.id,
      categoria: 'empleado',
      rol: 'pm_obra',
      nombre: 'PM Ensayo',
      telegram_chat_id: PERSONAS_ENSAYO.pm.chatId,
      activo: true,
    })
    await enSimulacionBot(() => listarAprobadoresProcuraTelegram(sb(d), OBRA_ENSAYO.id), { usuariosSistema: simulados })
    assert.deepEqual(d.tablas.ci_usuarios_sistema_telegram, [real])
  })

  it('en un ensayo los chats de ensayo están autorizados aunque la lista blanca no los tenga', async () => {
    await enSimulacionBot(async () => {
      assert.equal(await isChatAllowedAsync(PERSONAS_ENSAYO.logi.chatId), true)
    })
  })
})

describe('guion libre', () => {
  it('acepta pasos de texto, botón, dato y foto', () => {
    const r = leerGuion([
      { q: 'depo', t: '/salida' },
      { q: 'depo', b: 'obrero' },
      { q: 'ing', d: 'rq:ok' },
      { q: 'depo', f: 1, c: 'pie' },
    ])
    assert.deepEqual(r, {
      ok: true,
      guion: [
        { q: 'depo', t: '/salida' },
        { q: 'depo', b: 'obrero' },
        { q: 'ing', d: 'rq:ok' },
        { q: 'depo', f: true, c: 'pie' },
      ],
    })
  })

  it('rechaza personas que no son de ensayo, pasos sin acción o con dos, y guiones enormes', () => {
    assert.match(String((leerGuion([{ q: 'neo', t: 'hola' }]) as { error: string }).error), /«q» debe ser ing, depo, pm, conta, compra, logi/)
    assert.match(String((leerGuion([{ q: 'depo' }]) as { error: string }).error), /exactamente una acción/)
    assert.match(String((leerGuion([{ q: 'depo', t: 'a', b: 'b' }]) as { error: string }).error), /exactamente una acción/)
    assert.match(String((leerGuion({}) as { error: string }).error), /lista de pasos/)
    assert.match(
      String((leerGuion(Array.from({ length: 41 }, () => ({ q: 'depo', t: 'x' }))) as { error: string }).error),
      /hasta 40 pasos/,
    )
  })
})
