import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarMaterialesComprasPeriodo,
  type LineaMaterialCompraTelegram,
  type PeriodoComprasTelegram,
} from '@/lib/contabilidad/cargarComprasPeriodoTelegram';
import { etiquetaPeriodo, todayIsoVenezuela } from '@/lib/contabilidad/comprasFiltros';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';

export type { PeriodoComprasTelegram, LineaMaterialCompraTelegram };

const PREFIX_PAGE = 'cp:';
const PAGE_SIZE = 14;

function truncar(s: string, max = 52): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function emojiOrigen(origen: string | null | undefined): string {
  const o = String(origen ?? '').trim();
  if (o === 'Telegram') return '📱';
  if (o === 'Recepción') return '📦';
  return '🖥';
}

function tituloPeriodo(periodo: PeriodoComprasTelegram, rango: { desde: string; hasta: string }): string {
  if (periodo === 'dia') return `Compras del día <b>${rango.desde}</b>`;
  if (periodo === 'semana') return `Compras de la semana <b>${rango.desde}</b> → <b>${rango.hasta}</b>`;
  return `Compras del mes <b>${rango.desde}</b> → <b>${rango.hasta}</b>`;
}

function resumenLineas(lineas: LineaMaterialCompraTelegram[]): string {
  const facturas = new Set(lineas.map((l) => l.factura));
  let telegram = 0;
  let app = 0;
  for (const l of lineas) {
    if (l.origen === 'Telegram') telegram += 1;
    else app += 1;
  }
  return (
    `${lineas.length} material(es) · ${facturas.size} factura(s)\n` +
    `📱 Telegram: ${telegram} · 🖥 App/otros: ${app}`
  );
}

function formatearLinea(l: LineaMaterialCompraTelegram, idx: number): string {
  const cod = l.codigo ? ` <code>${escapeHtml(l.codigo)}</code>` : '';
  const cant = l.cantidad > 0 ? ` · <b>${l.cantidad}</b>` : '';
  const fac = escapeHtml(l.factura);
  const prov = escapeHtml(truncar(l.proveedor, 28));
  const art = escapeHtml(truncar(l.articulo, 40));
  const pendiente =
    l.estado && /PENDIENTE|EXTRAIDO|PROCESANDO|ERROR/i.test(l.estado)
      ? ' · <i>pendiente</i>'
      : '';
  return (
    `${idx + 1}. ${emojiOrigen(l.origen)} <b>${art}</b>${cod}${cant}${pendiente}\n` +
    `   <i>#${fac}</i> · ${prov} · ${escapeHtml(l.fecha)}`
  );
}

function callbackPage(periodo: PeriodoComprasTelegram, page: number): string {
  return `${PREFIX_PAGE}${periodo}:${page}`;
}

export function esCallbackComprasPeriodo(data: string): boolean {
  return data.startsWith(PREFIX_PAGE);
}

export function parseCallbackComprasPeriodo(
  data: string,
): { periodo: PeriodoComprasTelegram; page: number } | null {
  if (!data.startsWith(PREFIX_PAGE)) return null;
  const rest = data.slice(PREFIX_PAGE.length);
  const [periodo, pageStr] = rest.split(':');
  if (periodo !== 'dia' && periodo !== 'semana' && periodo !== 'mes') return null;
  const page = Number(pageStr);
  if (!Number.isFinite(page) || page < 0) return null;
  return { periodo, page: Math.floor(page) };
}

function buildKeyboard(periodo: PeriodoComprasTelegram, totalLineas: number, page: number) {
  const totalPages = Math.max(1, Math.ceil(totalLineas / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  if (totalPages <= 1) return undefined;

  const nav: Array<{ text: string; callback_data: string }> = [];
  if (safePage > 0) nav.push({ text: '◀ Anterior', callback_data: callbackPage(periodo, safePage - 1) });
  nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: callbackPage(periodo, safePage) });
  if (safePage < totalPages - 1) nav.push({ text: 'Siguiente ▶', callback_data: callbackPage(periodo, safePage + 1) });
  return { inline_keyboard: [nav] };
}

export async function manejarComandoComprasPeriodoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  periodo: PeriodoComprasTelegram,
  page = 0,
): Promise<void> {
  const refDate = todayIsoVenezuela();
  const { lineas, rango } = await cargarMaterialesComprasPeriodo(supabase, periodo, refDate);
  const periodoLabel = etiquetaPeriodo(periodo, refDate, rango);

  if (!lineas.length) {
    await sendTelegramMessage(
      chatId,
      `🛒 <b>${tituloPeriodo(periodo, rango)}</b>\n\n` +
        `Sin compras en el periodo (${escapeHtml(periodoLabel)}).\n` +
        '<i>Incluye facturas en contabilidad y pendientes de Telegram (fecha de factura o de registro).</i>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(lineas.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = lineas.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const cuerpo = slice.map((l, i) => formatearLinea(l, safePage * PAGE_SIZE + i)).join('\n\n');

  let texto =
    `🛒 <b>${tituloPeriodo(periodo, rango)}</b>\n` +
    `${resumenLineas(lineas)}\n` +
    `<i>${escapeHtml(periodoLabel)} · página ${safePage + 1}/${totalPages}</i>\n\n` +
    cuerpo;

  if (texto.length > 4000) {
    texto =
      `🛒 <b>${tituloPeriodo(periodo, rango)}</b>\n` +
      `${resumenLineas(lineas)}\n` +
      `<i>Página ${safePage + 1}/${totalPages} — use ◀ ▶ para ver más líneas.</i>\n\n` +
      slice
        .slice(0, 8)
        .map((l, i) => formatearLinea(l, safePage * PAGE_SIZE + i))
        .join('\n\n');
  }

  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: buildKeyboard(periodo, lineas.length, safePage),
  });
}

export async function manejarCallbackComprasPeriodoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const parsed = parseCallbackComprasPeriodo(params.data);
  if (!parsed) return false;

  try {
    await answerCallbackQuery(params.callbackId);
    await manejarComandoComprasPeriodoTelegram(supabase, params.chatId, parsed.periodo, parsed.page);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar compras';
    await sendTelegramMessage(params.chatId, `❌ ${escapeHtml(msg)}`, { parse_mode: 'HTML' });
  }
  return true;
}
