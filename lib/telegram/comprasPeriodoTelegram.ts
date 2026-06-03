import type { SupabaseClient } from '@supabase/supabase-js';
import {
  etiquetaPeriodo,
  rangoFechasPeriodo,
  todayIso,
  type PeriodoCompras,
} from '@/lib/contabilidad/comprasFiltros';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';

export type PeriodoComprasTelegram = Extract<PeriodoCompras, 'dia' | 'semana' | 'mes'>;

const PREFIX_PAGE = 'cp:';
const PAGE_SIZE = 14;
const MAX_COMPRAS = 400;

export type LineaMaterialCompraTelegram = {
  fecha: string;
  factura: string;
  proveedor: string;
  origen: string;
  articulo: string;
  codigo: string;
  cantidad: number;
};

type CompraRowDb = {
  fecha: string | null;
  invoice_number: string | null;
  supplier_name: string | null;
  origen: string | null;
  contabilidad_compra_lineas?:
    | Array<{
        descripcion: string | null;
        item_code: string | null;
        cantidad: number | null;
      }>
    | { count: number }[]
    | null;
};

function truncar(s: string, max = 52): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function etiquetaOrigen(origen: string | null | undefined): string {
  const o = String(origen ?? '').trim().toUpperCase();
  if (o === 'TELEGRAM') return 'Telegram';
  if (o === 'RECEPCION_MERCANCIA') return 'Recepción';
  if (o === 'MANUAL' || o === 'APP') return 'App';
  return o ? o.charAt(0) + o.slice(1).toLowerCase() : 'App';
}

function emojiOrigen(origen: string | null | undefined): string {
  const o = String(origen ?? '').trim().toUpperCase();
  if (o === 'TELEGRAM') return '📱';
  if (o === 'RECEPCION_MERCANCIA') return '📦';
  return '🖥';
}

function tituloPeriodo(periodo: PeriodoComprasTelegram, rango: { desde: string; hasta: string }): string {
  if (periodo === 'dia') return `Compras del día <b>${rango.desde}</b>`;
  if (periodo === 'semana') return `Compras de la semana <b>${rango.desde}</b> → <b>${rango.hasta}</b>`;
  return `Compras del mes <b>${rango.desde}</b> → <b>${rango.hasta}</b>`;
}

function lineasDesdeCompra(c: CompraRowDb): LineaMaterialCompraTelegram[] {
  const nested = c.contabilidad_compra_lineas;
  if (!Array.isArray(nested) || !nested.length) return [];
  const first = nested[0];
  if (!first || !('descripcion' in first)) return [];

  const fecha = String(c.fecha ?? '').slice(0, 10);
  const factura = String(c.invoice_number ?? 'S/N').trim();
  const proveedor = String(c.supplier_name ?? 'Proveedor').trim();
  const origen = etiquetaOrigen(c.origen);

  return (nested as Array<{
    descripcion: string | null;
    item_code: string | null;
    cantidad: number | null;
  }>)
    .map((l) => {
      const articulo = String(l.descripcion ?? '').trim();
      if (!articulo) return null;
      return {
        fecha,
        factura,
        proveedor,
        origen,
        articulo,
        codigo: String(l.item_code ?? '').trim(),
        cantidad: Number(l.cantidad) > 0 ? Number(l.cantidad) : 0,
      };
    })
    .filter((x): x is LineaMaterialCompraTelegram => x !== null);
}

export async function cargarMaterialesComprasPeriodo(
  supabase: SupabaseClient,
  periodo: PeriodoComprasTelegram,
  refDate = todayIso(),
): Promise<{ lineas: LineaMaterialCompraTelegram[]; rango: { desde: string; hasta: string } }> {
  const rango = rangoFechasPeriodo(periodo, refDate);
  if (!rango) return { lineas: [], rango: { desde: refDate, hasta: refDate } };

  const { data, error } = await supabase
    .from('contabilidad_compras')
    .select(
      'fecha,invoice_number,supplier_name,origen,contabilidad_compra_lineas(descripcion,item_code,cantidad)',
    )
    .gte('fecha', rango.desde)
    .lte('fecha', rango.hasta)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(MAX_COMPRAS);

  if (error) throw new Error(error.message);

  const lineas: LineaMaterialCompraTelegram[] = [];
  for (const row of (data ?? []) as CompraRowDb[]) {
    const det = lineasDesdeCompra(row);
    if (det.length) {
      lineas.push(...det);
      continue;
    }
    const fecha = String(row.fecha ?? '').slice(0, 10);
    lineas.push({
      fecha,
      factura: String(row.invoice_number ?? 'S/N').trim(),
      proveedor: String(row.supplier_name ?? 'Proveedor').trim(),
      origen: etiquetaOrigen(row.origen),
      articulo: '(factura sin detalle de líneas)',
      codigo: '',
      cantidad: 0,
    });
  }

  return { lineas, rango };
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
  const ori = emojiOrigen(
    l.origen === 'Telegram'
      ? 'TELEGRAM'
      : l.origen === 'Recepción'
        ? 'RECEPCION_MERCANCIA'
        : 'APP',
  );
  return (
    `${idx + 1}. ${ori} <b>${art}</b>${cod}${cant}\n` +
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
  const { lineas, rango } = await cargarMaterialesComprasPeriodo(supabase, periodo);
  const periodoLabel = etiquetaPeriodo(periodo, todayIso(), rango);

  if (!lineas.length) {
    await sendTelegramMessage(
      chatId,
      `🛒 <b>${tituloPeriodo(periodo, rango)}</b>\n\n` +
        `Sin compras registradas (${escapeHtml(periodoLabel)}).\n` +
        '<i>Incluye facturas confirmadas en la app y por Telegram.</i>',
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

  await answerCallbackQuery(params.callbackId);
  await manejarComandoComprasPeriodoTelegram(supabase, params.chatId, parsed.periodo, parsed.page);
  return true;
}
