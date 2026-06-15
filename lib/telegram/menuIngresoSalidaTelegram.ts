import type { SupabaseClient } from '@supabase/supabase-js';
import type { FacturaPendienteIngreso } from '@/lib/almacen/listarFacturasPendientesIngreso';
import { listarFacturasPendientesIngreso } from '@/lib/almacen/listarFacturasPendientesIngreso';
import {
  agruparProveedoresFacturasPrecargadas,
  etiquetaFacturaBotonPorNumero,
  manejarComandoIngresoFacturaTelegram,
  ordenarFacturasPendientesPorNumero,
  proveedorKeyFactura,
  seleccionarFacturaPrecargadaTelegram,
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
const MENU_PROV_PAGE_SIZE = 8;
const MENU_FACT_PAGE_SIZE = 8;

function truncar(s: string, max = 52): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function callbackMenuProveedor(key: string): string {
  return `${PREFIX_INGRESO}pr:${key}`;
}

function callbackMenuFactura(key: string): string {
  return `${PREFIX_INGRESO}fc:${key}`;
}

function callbackMenuFacturasPagina(provKey: string, page: number): string {
  return `${PREFIX_INGRESO}fp:${provKey}:${page}`;
}

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
  pageProveedores = 0,
): Promise<void> {
  const facturas = await listarFacturasPendientesIngreso(supabase);

  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '🧾 Ingreso manual de factura', callback_data: callbackMenuIngreso('factura') }],
    [{ text: '🤖 Ingreso automático de factura', callback_data: callbackMenuIngreso('factauto') }],
    [{ text: '📄 Ingreso con nota de entrega', callback_data: callbackMenuIngreso('nota') }],
    [{ text: '📝 Ingreso sin nota', callback_data: callbackMenuIngreso('sinnota') }],
  ];

  const nIngreso = facturas.filter((f) => f.accion === 'ingreso_almacen').length;
  const nConfirmar = facturas.length - nIngreso;
  let texto = '📥 <b>Ingreso a almacén</b>\n\nElige el tipo de ingreso:';

  if (facturas.length) {
    const proveedores = agruparProveedoresFacturasPrecargadas(facturas);
    const totalPages = Math.max(1, Math.ceil(proveedores.length / MENU_PROV_PAGE_SIZE));
    const safePage = Math.min(Math.max(0, pageProveedores), totalPages - 1);
    const slice = proveedores.slice(
      safePage * MENU_PROV_PAGE_SIZE,
      safePage * MENU_PROV_PAGE_SIZE + MENU_PROV_PAGE_SIZE,
    );

    texto +=
      `\n\n<b>Facturas precargadas</b> — elige <b>proveedor</b> (${facturas.length})` +
      (nIngreso ? `\n📥 ${nIngreso} para ingreso` : '') +
      (nConfirmar ? `\n⏳ ${nConfirmar} pend. confirmar compra` : '') +
      '\n<i>Luego verás las facturas por número.</i>';

    for (const p of slice) {
      rows.push([
        {
          text: truncar(`🏢 ${p.nombre} (${p.count})`),
          callback_data: callbackMenuProveedor(p.key),
        },
      ]);
    }

    if (totalPages > 1) {
      const nav: Array<{ text: string; callback_data: string }> = [];
      if (safePage > 0) {
        nav.push({ text: '◀', callback_data: `${PREFIX_INGRESO}pp:${safePage - 1}` });
      }
      nav.push({
        text: `${safePage + 1}/${totalPages}`,
        callback_data: `${PREFIX_INGRESO}pp:${safePage}`,
      });
      if (safePage < totalPages - 1) {
        nav.push({ text: '▶', callback_data: `${PREFIX_INGRESO}pp:${safePage + 1}` });
      }
      rows.push(nav);
    }
  }

  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: rows },
  });
}

function tecladoFacturasPrecargadasMenu(
  facturas: FacturaPendienteIngreso[],
  provKey: string,
  page: number,
) {
  const totalPages = Math.max(1, Math.ceil(facturas.length / MENU_FACT_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = facturas.slice(
    safePage * MENU_FACT_PAGE_SIZE,
    safePage * MENU_FACT_PAGE_SIZE + MENU_FACT_PAGE_SIZE,
  );
  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((f) => [
    {
      text: etiquetaFacturaBotonPorNumero(f),
      callback_data: callbackMenuFactura(f.key),
    },
  ]);
  buttons.push([{ text: '◀ Proveedores', callback_data: `${PREFIX_INGRESO}back` }]);
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) {
      nav.push({ text: '◀', callback_data: callbackMenuFacturasPagina(provKey, safePage - 1) });
    }
    nav.push({
      text: `${safePage + 1}/${totalPages}`,
      callback_data: callbackMenuFacturasPagina(provKey, safePage),
    });
    if (safePage < totalPages - 1) {
      nav.push({ text: '▶', callback_data: callbackMenuFacturasPagina(provKey, safePage + 1) });
    }
    buttons.push(nav);
  }
  return { inline_keyboard: buttons };
}

async function enviarFacturasPrecargadasMenuPorProveedor(
  supabase: SupabaseClient,
  chatId: string,
  provKey: string,
  page = 0,
): Promise<void> {
  const todas = await listarFacturasPendientesIngreso(supabase);
  const facturas = ordenarFacturasPendientesPorNumero(
    todas.filter((f) => proveedorKeyFactura(f.supplier_name) === provKey),
  );

  if (!facturas.length) {
    await enviarMenuIngresoTelegram(supabase, chatId);
    return;
  }

  if (facturas.length === 1) {
    await seleccionarFacturaPrecargadaTelegram(supabase, chatId, facturas[0]!.key);
    return;
  }

  const nombre = facturas[0]?.supplier_name ?? 'Proveedor';
  await sendTelegramMessage(
    chatId,
    `🏢 <b>${escapeHtml(nombre)}</b>\n\n` +
      `Elige la factura por <b>número</b> (${facturas.length}):`,
    {
      parse_mode: 'HTML',
      reply_markup: tecladoFacturasPrecargadasMenu(facturas, provKey, page),
    },
  );
}

async function manejarProveedorPrecargadoMenu(
  supabase: SupabaseClient,
  chatId: string,
  provKey: string,
): Promise<void> {
  await enviarFacturasPrecargadasMenuPorProveedor(supabase, chatId, provKey, 0);
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

  if (raw === 'back') {
    await answerCallbackQuery(params.callbackId);
    await enviarMenuIngresoTelegram(supabase, params.chatId);
    return true;
  }

  if (raw.startsWith('pp:')) {
    const page = Number(raw.slice(3));
    if (!Number.isFinite(page) || page < 0) return false;
    await answerCallbackQuery(params.callbackId);
    try {
      await enviarMenuIngresoTelegram(supabase, params.chatId, Math.floor(page));
    } catch (e) {
      console.error('[telegram menu ingreso pagina proveedores]', e);
    }
    return true;
  }

  if (raw.startsWith('pg:')) {
    const page = Number(raw.slice(3));
    if (!Number.isFinite(page) || page < 0) return false;
    await answerCallbackQuery(params.callbackId);
    await enviarMenuIngresoTelegram(supabase, params.chatId, Math.floor(page));
    return true;
  }

  if (raw.startsWith('fp:')) {
    const rest = raw.slice(3);
    const sep = rest.lastIndexOf(':');
    if (sep <= 0) return false;
    const provKey = rest.slice(0, sep);
    const page = Number(rest.slice(sep + 1));
    if (!Number.isFinite(page) || page < 0) return false;
    await answerCallbackQuery(params.callbackId);
    try {
      await enviarFacturasPrecargadasMenuPorProveedor(
        supabase,
        params.chatId,
        provKey,
        Math.floor(page),
      );
    } catch (e) {
      console.error('[telegram menu ingreso facturas proveedor]', e);
    }
    return true;
  }

  if (raw.startsWith('pr:')) {
    const provKey = raw.slice(3);
    if (!provKey) return false;
    await answerCallbackQuery(params.callbackId);
    try {
      await manejarProveedorPrecargadoMenu(supabase, params.chatId, provKey);
    } catch (e) {
      console.error('[telegram menu ingreso proveedor]', e);
    }
    return true;
  }

  if (raw.startsWith('fc:')) {
    const key = raw.slice(3);
    if (!key) return false;
    await answerCallbackQuery(params.callbackId, 'Cargando factura…');
    try {
      const resultado = await seleccionarFacturaPrecargadaTelegram(supabase, params.chatId, key);
      if (resultado === 'not_found') {
        await sendTelegramMessage(
          params.chatId,
          '⚠️ Factura no encontrada o ya ingresada. Use <code>/ingreso</code> de nuevo.',
          { parse_mode: 'HTML' },
        );
      }
    } catch (e) {
      console.error('[telegram menu ingreso factura]', e);
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
