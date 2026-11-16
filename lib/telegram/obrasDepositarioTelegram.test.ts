import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { filtrarFacturasPorObras, type FacturaPendienteIngreso } from '@/lib/almacen/listarFacturasPendientesIngreso';
import {
  botonesDe,
  capturarTelegram,
  crearFakeSupabase,
} from '@/lib/telegram/testing/fakeSupabase';
import { obrasVisiblesParaChat } from '@/lib/telegram/facturasPendientesDeMisObras';
import {
  enviarPickerProyectosTelegram,
  manejarCallbackProyectoTelegram,
} from '@/lib/telegram/proyectoPicker';
import {
  enviarPickerObrasAguaTelegram,
  manejarCallbackAguaTelegram,
} from '@/lib/telegram/aguaRegistro';
import { manejarCallbackMermaTelegram } from '@/lib/telegram/mermaTelegram';
import {
  manejarCallbackStockConsultaTelegram,
  manejarComandoStockConsultaTelegram,
} from '@/lib/telegram/stockConsultaTelegram';
import { manejarCallbackStockObraTelegram } from '@/lib/telegram/stockCommand';
import {
  MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO,
  alcanceObrasDepositarioParaChat,
  filtrarProyectosPorAlcanceDepositario,
  filtrarUbicacionesPorAlcanceDepositario,
  modoPickerAplicaRestriccionDepositario,
  obraPermitidaSegunAlcanceDepositario,
  obrasDondeEsDepositarioNomina,
} from '@/lib/telegram/obrasDepositarioTelegram';

const CHAT = '900';
const CHAT_ADMIN = '100';
const CHAT_OTRO = '300';
const RANCHO = 'e45497e0-5c4f-41dc-bc68-aa2274b1e100';
const OTRA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const TERCERA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const ENTIDAD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ALM_RANCHO = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const ALM_OTRA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

function sb(tablas: Record<string, Array<Record<string, unknown>>>) {
  return crearFakeSupabase({
    ci_telegram_estados: [],
    ci_usuarios_sistema_telegram: [],
    ci_empleados: [],
    bot_estados: [],
    ci_entidades: [{ id: ENTIDAD, nombre: 'Casa Inteligente' }],
    ...tablas,
  }) as unknown as SupabaseClient;
}

function dosObras(extraNomina: Record<string, unknown>[] = []) {
  return sb({
    ci_proyectos: [
      { id: RANCHO, nombre: 'Rancho Flamboyant', entidad_id: ENTIDAD },
      { id: OTRA, nombre: 'Obra Sur', entidad_id: ENTIDAD },
    ],
    ci_proyecto_nomina: extraNomina,
    inv_ubicaciones: [
      {
        id: ALM_RANCHO,
        codigo: 'DEP-RANCHO',
        nombre: 'ALMACÉN – RANCHO FLAMBOYANT',
        tipo: 'almacen_central',
        ci_proyecto_id: RANCHO,
        activo: true,
        ubicacion_padre_id: null,
      },
      {
        id: ALM_OTRA,
        codigo: 'DEP-SUR',
        nombre: 'ALMACÉN – OBRA SUR',
        tipo: 'almacen_central',
        ci_proyecto_id: OTRA,
        activo: true,
        ubicacion_padre_id: null,
      },
    ],
  });
}

function nominaDepositario(proyectoIds: string[]) {
  return proyectoIds.map((proyecto_id) => ({
    telegram_chat_id: CHAT,
    rol: 'depositario',
    activo: true,
    proyecto_id,
  }));
}

describe('alcance de obras del depositario', () => {
  let telegram: ReturnType<typeof capturarTelegram>;

  beforeEach(() => {
    telegram = capturarTelegram();
  });
  afterEach(() => {
    telegram.restaurar();
  });

  it('helpers: solo restringe modos de almacén y filtra por set de obras', () => {
    assert.equal(modoPickerAplicaRestriccionDepositario('ingreso_manual'), true);
    assert.equal(modoPickerAplicaRestriccionDepositario('salida_almacen'), true);
    assert.equal(modoPickerAplicaRestriccionDepositario('procura'), false);
    assert.equal(modoPickerAplicaRestriccionDepositario('factura_compra'), false);

    const set = new Set([RANCHO]);
    assert.equal(obraPermitidaSegunAlcanceDepositario(RANCHO, set), true);
    assert.equal(obraPermitidaSegunAlcanceDepositario(OTRA, set), false);
    assert.equal(obraPermitidaSegunAlcanceDepositario(OTRA, 'todas'), true);
    assert.equal(obraPermitidaSegunAlcanceDepositario(OTRA, null), true);

    const proyectos = [
      { id: RANCHO, nombre: 'Rancho' },
      { id: OTRA, nombre: 'Sur' },
    ];
    assert.deepEqual(
      filtrarProyectosPorAlcanceDepositario(proyectos, set).map((p) => p.id),
      [RANCHO],
    );
    assert.equal(filtrarProyectosPorAlcanceDepositario(proyectos, null).length, 2);

    const ubis = [
      { id: '1', obra_id: RANCHO },
      { id: '2', ci_proyecto_id: OTRA },
    ];
    assert.deepEqual(
      filtrarUbicacionesPorAlcanceDepositario(ubis, set).map((u) => u.id),
      ['1'],
    );
  });

  it('obrasDondeEsDepositarioNomina ignora otros roles de la misma persona', async () => {
    const db = dosObras([
      { telegram_chat_id: CHAT, rol: 'depositario', activo: true, proyecto_id: RANCHO },
      { telegram_chat_id: CHAT, rol: 'ingeniero', activo: true, proyecto_id: OTRA },
    ]);
    const obras = await obrasDondeEsDepositarioNomina(db, CHAT);
    assert.deepEqual([...obras], [RANCHO]);
    const alcance = await alcanceObrasDepositarioParaChat(db, CHAT);
    assert.ok(alcance instanceof Set);
    assert.deepEqual([...(alcance as Set<string>)], [RANCHO]);
  });

  it('el administrador no queda restringido aunque tenga fila de depositario', async () => {
    const db = sb({
      ci_proyectos: [{ id: RANCHO, nombre: 'Rancho Flamboyant' }],
      ci_proyecto_nomina: [
        { telegram_chat_id: CHAT_ADMIN, rol: 'depositario', activo: true, proyecto_id: RANCHO },
      ],
      ci_usuarios_sistema_telegram: [
        {
          id: 'u-admin',
          telegram_id: Number(CHAT_ADMIN),
          rol: 'Administrador',
          activo: true,
          nombre: 'Luis',
        },
      ],
    });
    assert.equal(await alcanceObrasDepositarioParaChat(db, CHAT_ADMIN), 'todas');
    assert.equal(await obrasVisiblesParaChat(db, CHAT_ADMIN), 'todas');
  });

  it('obrasVisiblesParaChat del depositario no incluye obras de otro rol', async () => {
    const db = dosObras([
      { telegram_chat_id: CHAT, rol: 'depositario', activo: true, proyecto_id: RANCHO },
      { telegram_chat_id: CHAT, rol: 'obrero', activo: true, proyecto_id: OTRA },
    ]);
    const visibles = await obrasVisiblesParaChat(db, CHAT);
    assert.ok(visibles instanceof Set);
    assert.deepEqual([...(visibles as Set<string>)], [RANCHO]);
  });

  it('/factura: solo deja facturas de la obra del depositario', async () => {
    const facturas: FacturaPendienteIngreso[] = [
      {
        key: 'a',
        origen: 'telegram',
        origenLabel: 'Telegram',
        invoice_number: '1',
        supplier_name: 'Prov A',
        fecha: null,
        estado: 'confirmado',
        accion: 'ingreso_almacen',
        pendienteId: 'p1',
        purchase_invoice_id: null,
        proyecto_id: RANCHO,
      },
      {
        key: 'b',
        origen: 'app',
        origenLabel: 'App',
        invoice_number: '2',
        supplier_name: 'Prov B',
        fecha: null,
        estado: 'confirmado',
        accion: 'ingreso_almacen',
        pendienteId: 'p2',
        purchase_invoice_id: null,
        proyecto_id: OTRA,
      },
    ];
    const db = dosObras(nominaDepositario([RANCHO]));
    const visibles = await obrasVisiblesParaChat(db, CHAT);
    assert.deepEqual(
      filtrarFacturasPorObras(facturas, visibles, CHAT).map((f) => f.key),
      ['a'],
    );
  });

  it('/salida e /ingreso: con una sola obra la auto-selecciona y no lista las demás', async () => {
    const db = dosObras(nominaDepositario([RANCHO]));
    await enviarPickerProyectosTelegram(db, CHAT, 'salida_obra');
    const textos = telegram.enviados.map((m) => String(m.text ?? ''));
    assert.ok(textos.some((t) => /Rancho Flamboyant/i.test(t)));
    assert.equal(
      telegram.enviados.some((m) => botonesDe(m).some((b) => /Obra Sur/i.test(b))),
      false,
    );
    assert.ok(textos.some((t) => /Obra:/i.test(t) && /Rancho Flamboyant/i.test(t)));
  });

  it('/ingreso: con varias obras del depositario solo ofrece esas', async () => {
    const db = sb({
      ci_proyectos: [
        { id: RANCHO, nombre: 'Rancho Flamboyant', entidad_id: ENTIDAD },
        { id: OTRA, nombre: 'Obra Sur', entidad_id: ENTIDAD },
        { id: TERCERA, nombre: 'Obra Este', entidad_id: ENTIDAD },
      ],
      ci_proyecto_nomina: nominaDepositario([RANCHO, TERCERA]),
      inv_ubicaciones: [],
    });
    await enviarPickerProyectosTelegram(db, CHAT, 'ingreso_manual');
    const botones = botonesDe(telegram.enviados.at(-1));
    assert.ok(botones.some((b) => /Rancho Flamboyant/i.test(b)));
    assert.ok(botones.some((b) => /Obra Este/i.test(b)));
    assert.equal(botones.some((b) => /Obra Sur/i.test(b)), false);
  });

  it('rechaza en servidor un callback de obra ajena', async () => {
    const db = dosObras(nominaDepositario([RANCHO]));
    const handled = await manejarCallbackProyectoTelegram(db, {
      chatId: CHAT,
      callbackId: 'cb',
      data: `ps:h:${OTRA}`,
    });
    assert.equal(handled, true);
    const alertas = telegram.enviados.filter((m) => m.metodo === 'answerCallbackQuery');
    assert.ok(alertas.some((m) => String(m.text ?? '').includes('obra asignada')));
  });

  it('un chat sin rol depositario sigue viendo todas las obras en /ingreso', async () => {
    const db = dosObras([]);
    await enviarPickerProyectosTelegram(db, CHAT_OTRO, 'ingreso_manual');
    const botones = botonesDe(telegram.enviados.at(-1));
    assert.ok(botones.some((b) => /Rancho Flamboyant/i.test(b)));
    assert.ok(botones.some((b) => /Obra Sur/i.test(b)));
  });

  it('/agua: una sola obra se auto-selecciona; un callback ajeno se rechaza', async () => {
    const db = dosObras(nominaDepositario([RANCHO]));
    await enviarPickerObrasAguaTelegram(db, CHAT, 0, CHAT);
    const textos = telegram.enviados.map((m) => String(m.text ?? ''));
    assert.ok(textos.some((t) => /Rancho Flamboyant/i.test(t)));
    assert.equal(
      telegram.enviados.some((m) => botonesDe(m).some((b) => /Obra Sur/i.test(b))),
      false,
    );

    const handled = await manejarCallbackAguaTelegram(db, {
      chatId: CHAT,
      userId: CHAT,
      callbackId: 'cb',
      data: `agua:sel:${OTRA}`,
    });
    assert.equal(handled, true);
    assert.ok(
      telegram.enviados.some(
        (m) => m.metodo === 'answerCallbackQuery' && String(m.text ?? '').includes('obra asignada'),
      ),
    );
  });

  it('/stock: con una obra salta entidad y va al almacén de esa obra', async () => {
    const db = dosObras(nominaDepositario([RANCHO]));
    await manejarComandoStockConsultaTelegram(db, CHAT);
    const textos = telegram.enviados.map((m) => String(m.text ?? ''));
    assert.ok(textos.some((t) => /Rancho Flamboyant/i.test(t)));
    assert.equal(textos.some((t) => /Elige la <b>entidad<\/b>/i.test(t)), false);
    assert.ok(
      textos.some((t) => /ALMACÉN – RANCHO FLAMBOYANT/i.test(t) || /Stock/i.test(t)),
    );
  });

  it('/stock: rechaza callback de otra obra', async () => {
    const db = dosObras(nominaDepositario([RANCHO]));
    const handled = await manejarCallbackStockObraTelegram(db, {
      chatId: CHAT,
      callbackId: 'cb',
      data: `sk:a:${OTRA}:0`,
    });
    assert.equal(handled, true);
    assert.ok(
      telegram.enviados.some(
        (m) =>
          m.metodo === 'answerCallbackQuery' &&
          String(m.text ?? '').includes('obra asignada'),
      ),
    );
  });

  it('/stock guiado: rechaza elegir un almacén de otra obra', async () => {
    const db = dosObras(nominaDepositario([RANCHO]));
    (db as unknown as { tablas: Record<string, unknown[]> }).tablas.ci_telegram_estados.push({
      chat_id: CHAT,
      contexto: 'consulta_stock',
      proyecto_id: RANCHO,
      pending_factura_id: null,
      metadata: { flujo: 'stock_consulta_almacen', paso: 'almacen', proyecto_id: RANCHO },
    });
    const handled = await manejarCallbackStockConsultaTelegram(db, {
      chatId: CHAT,
      callbackId: 'cb',
      data: `st:u:${ALM_OTRA}`,
    });
    assert.equal(handled, true);
    assert.ok(
      telegram.enviados.some(
        (m) =>
          m.metodo === 'answerCallbackQuery' &&
          (String(m.text ?? '').includes('obra asignada') ||
            String(m.text ?? '') === MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO),
      ),
    );
  });

  it('merma: rechaza un almacén que no es de su obra', async () => {
    const db = dosObras(nominaDepositario([RANCHO]));
    (db as unknown as { tablas: Record<string, unknown[]> }).tablas.ci_telegram_estados.push({
      chat_id: CHAT,
      contexto: 'merma_almacen',
      proyecto_id: RANCHO,
      pending_factura_id: null,
      metadata: { flujo: 'merma_almacen', paso: 'almacen' },
    });
    const handled = await manejarCallbackMermaTelegram(db, {
      chatId: CHAT,
      callbackId: 'cb',
      data: `mr:ub:${ALM_OTRA}`,
    });
    assert.equal(handled, true);
    assert.ok(
      telegram.enviados.some(
        (m) => m.metodo === 'answerCallbackQuery' && String(m.text ?? '').includes('obra asignada'),
      ),
    );
  });
});
