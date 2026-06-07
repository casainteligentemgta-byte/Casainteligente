import type { SupabaseClient } from '@supabase/supabase-js';
import { listarFacturasPendientesIngreso } from '@/lib/almacen/listarFacturasPendientesIngreso';
import {
  callbackFacturaPrecargada,
  etiquetaFacturaBoton,
  manejarComandoIngresoFacturaTelegram,
} from '@/lib/telegram/ingresoFacturaTelegram';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  manejarComandoIngresoFacturaManualTelegram,
  manejarComandoIngresoFacturaOcrAutomaticoTelegram,
  manejarComandoIngresoSinNotaTelegram,
  manejarComandoNotaEntregaTelegram,
} from '@/lib/telegram/ingresoManualTelegram';
import { manejarComandoSalidaEgresoTelegram } from '@/lib/telegram/salidaEgresoFlujo';
import { manejarComandoSalidaObraTelegram } from '@/lib/telegram/salidaObraTelegram';
import { manejarComandoTraspasoTelegram } from '@/lib/telegram/traspasoFlujoTelegram';

const PREFIX_INGRESO = 'ig:';
const PREFIX_SALIDA = 'sg:';
const MENU_FACTURAS_PAGE_SIZE = 5;

/** Opciones del submenú /ingreso (4 flujos + listado precargadas). */
export type OpcionMenuIngreso = 'factura' | 'factauto' | 'nota' | 'sinnota' | 'precargadas';
export type OpcionMenuSalida = 'obra' | 'almacen' | 'prestamo';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function esCallbackMenuIngresoTelegram(data: string): boolean {
  return data.startsWith(PREFIX_INGRESO);
}

export function esCallbackMenuSalidaTelegram(data: string): boolean {
  return data.startsWith(PREFIX_SALIDA);
}

export function callbackMenuIngreso(opcion: OpcionMenuIngreso): string {
  return `${PREFIX_INGRESO}${opcion}`;
}

export function callbackMenuSalida(opcion: OpcionMenuSalida): string {
  return `${PREFIX_SALIDA}${opcion}`;
}

export async function manejarComandoIngresoTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await enviarMenuIngresoTelegram(supabase, chatId);
}

export async function enviarMenuIngresoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pageFacturas = 0,
): Promise<void> {
  const facturas = await listarFacturasPendientesIngreso(supabase);

  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '🧾 Ingreso manual de factura', callback_data: callbackMenuIngreso('factura') }],
    [{ text: '🤖 Ingreso automático de factura', callback_data: callbackMenuIngreso('factauto') }],
    [{ text: '📄 Ingreso con nota de entrega', callback_data: callbackMenuIngreso('nota') }],
    [{ text: '📝 Ingreso sin nota', callback_data: callbackMenuIngreso('sinnota') }],
  ];

  if (facturas.length) {
    const totalPages = Math.max(1, Math.ceil(facturas.length / MENU_FACTURAS_PAGE_SIZE));
    const safePage = Math.min(Math.max(0, pageFacturas), totalPages - 1);
    const slice = facturas.slice(
      safePage * MENU_FACTURAS_PAGE_SIZE,
      safePage * MENU_FACTURAS_PAGE_SIZE + MENU_FACTURAS_PAGE_SIZE,
    );

    for (const f of slice) {
      rows.push([
        {
          text: etiquetaFacturaBoton(f),
          callback_data: callbackFacturaPrecargada(f.key),
        },
      ]);
    }

    if (totalPages > 1) {
      const nav: Array<{ text: string; callback_data: string }> = [];
      if (safePage > 0) {
        nav.push({ text: '◀', callback_data: `${PREFIX_INGRESO}pg:${safePage - 1}` });
      }
      nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX_INGRESO}pg:${safePage}` });
      if (safePage < totalPages - 1) {
        nav.push({ text: '▶', callback_data: `${PREFIX_INGRESO}pg:${safePage + 1}` });
      }
      rows.push(nav);
    }

    if (facturas.length > MENU_FACTURAS_PAGE_SIZE) {
      rows.push([
        {
          text: '📋 Ver todas por proveedor',
          callback_data: callbackMenuIngreso('precargadas'),
        },
      ]);
    }
  }

  const nIngreso = facturas.filter((f) => f.accion === 'ingreso_almacen').length;
  const nConfirmar = facturas.length - nIngreso;
  let texto = '📥 <b>Ingreso a almacén</b>\n\nElige el tipo de ingreso:';
  if (facturas.length) {
    texto +=
      `\n\n<b>Facturas precargadas</b> (${facturas.length})` +
      (nIngreso ? `\n📥 ${nIngreso} lista(s) para ingreso` : '') +
      (nConfirmar ? `\n⏳ ${nConfirmar} requiere(n) confirmar compra` : '') +
      '\n<i>📥 = ingresar · ⏳ = confirmar compra primero</i>';
  }

  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: rows },
  });
}

export async function enviarMenuSalidaTelegram(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '📤 <b>Salida de material</b>\n\n' + 'Elige el tipo de salida:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏗 Salida a obra', callback_data: callbackMenuSalida('obra') }],
          [{ text: '🏭 Salida a almacén', callback_data: callbackMenuSalida('almacen') }],
          [{ text: '🔄 Préstamo / traspaso', callback_data: callbackMenuSalida('prestamo') }],
        ],
      },
    },
  );
}

function normalizarOpcionMenuIngreso(raw: string): OpcionMenuIngreso | null {
  if (raw === 'manual') return 'sinnota';
  if (
    raw === 'factura' ||
    raw === 'factauto' ||
    raw === 'nota' ||
    raw === 'sinnota' ||
    raw === 'precargadas'
  ) {
    return raw;
  }
  return null;
}

async function iniciarIngresoPorOpcion(
  supabase: SupabaseClient,
  chatId: string,
  opcion: OpcionMenuIngreso,
): Promise<void> {
  switch (opcion) {
    case 'factura':
      await manejarComandoIngresoFacturaManualTelegram(supabase, chatId);
      break;
    case 'factauto':
      await manejarComandoIngresoFacturaOcrAutomaticoTelegram(supabase, chatId);
      break;
    case 'nota':
      await manejarComandoNotaEntregaTelegram(supabase, chatId);
      break;
    case 'sinnota':
      await manejarComandoIngresoSinNotaTelegram(supabase, chatId);
      break;
    case 'precargadas':
      await manejarComandoIngresoFacturaTelegram(supabase, chatId);
      break;
    default:
      await sendTelegramMessage(chatId, '⚠️ Opción no válida. Use <code>/ingreso</code>.', {
        parse_mode: 'HTML',
      });
  }
}

async function iniciarSalidaPorOpcion(
  supabase: SupabaseClient,
  chatId: string,
  opcion: OpcionMenuSalida,
): Promise<void> {
  switch (opcion) {
    case 'obra':
      await manejarComandoSalidaEgresoTelegram(supabase, chatId);
      break;
    case 'almacen':
      await manejarComandoSalidaObraTelegram(supabase, chatId);
      break;
    case 'prestamo':
      await manejarComandoTraspasoTelegram(supabase, chatId);
      break;
    default:
      await sendTelegramMessage(chatId, '⚠️ Opción no válida. Use <code>/salida</code>.', {
        parse_mode: 'HTML',
      });
  }
}

const ETIQUETA_INGRESO: Record<OpcionMenuIngreso, string> = {
  factura: 'Ingreso manual de factura',
  factauto: 'Ingreso automático de factura',
  nota: 'Ingreso con nota de entrega',
  sinnota: 'Ingreso sin nota',
  precargadas: 'Facturas precargadas',
};

const ETIQUETA_SALIDA: Record<OpcionMenuSalida, string> = {
  obra: 'Salida a obra',
  almacen: 'Salida a almacén',
  prestamo: 'Préstamo',
};

export async function manejarCallbackMenuIngresoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackMenuIngresoTelegram(params.data)) return false;

  const raw = params.data.slice(PREFIX_INGRESO.length);
  if (raw.startsWith('pg:')) {
    const page = Number(raw.slice(3));
    if (!Number.isFinite(page) || page < 0) return false;
    await answerCallbackQuery(params.callbackId);
    try {
      await enviarMenuIngresoTelegram(supabase, params.chatId, Math.floor(page));
    } catch (e) {
      console.error('[telegram menu ingreso pagina]', e);
    }
    return true;
  }

  const opcion = normalizarOpcionMenuIngreso(raw);
  if (!opcion) return false;

  await answerCallbackQuery(params.callbackId, ETIQUETA_INGRESO[opcion].slice(0, 40));
  try {
    await iniciarIngresoPorOpcion(supabase, params.chatId, opcion);
  } catch (e) {
    console.error('[telegram menu ingreso]', opcion, e);
    await sendTelegramMessage(
      params.chatId,
      `❌ No se pudo iniciar <b>${escapeHtml(ETIQUETA_INGRESO[opcion])}</b>.`,
      { parse_mode: 'HTML' },
    );
  }
  return true;
}

export async function manejarCallbackMenuSalidaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackMenuSalidaTelegram(params.data)) return false;
  const opcion = params.data.slice(PREFIX_SALIDA.length) as OpcionMenuSalida;
  if (!(opcion in ETIQUETA_SALIDA)) return false;

  await answerCallbackQuery(params.callbackId, ETIQUETA_SALIDA[opcion].slice(0, 40));
  try {
    await iniciarSalidaPorOpcion(supabase, params.chatId, opcion);
  } catch (e) {
    console.error('[telegram menu salida]', opcion, e);
    await sendTelegramMessage(
      params.chatId,
      `❌ No se pudo iniciar <b>${escapeHtml(ETIQUETA_SALIDA[opcion])}</b>.`,
      { parse_mode: 'HTML' },
    );
  }
  return true;
}
