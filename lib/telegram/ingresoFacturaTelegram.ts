import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarFacturasPendientesIngreso,
  type FacturaPendienteIngreso,
} from '@/lib/almacen/listarFacturasPendientesIngreso';
import { linkConfirmarCompraTelegram } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import { ingresoAlmacenDesdePendienteCanal } from '@/lib/contabilidad/ingresoAlmacenDesdePendienteCanal';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';

const PREFIX_SEL = 'if:';
const PREFIX_PAGE = 'ifp:';
const PAGE_SIZE = 8;

function truncar(s: string, max = 52): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

function callbackSel(key: string): string {
  return `${PREFIX_SEL}${key}`;
}

function callbackPage(page: number): string {
  return `${PREFIX_PAGE}${page}`;
}

export function esCallbackIngresoFactura(data: string): boolean {
  return data.startsWith(PREFIX_SEL) || data.startsWith(PREFIX_PAGE);
}

export function parseCallbackIngresoFactura(data: string):
  | { type: 'sel'; key: string }
  | { type: 'page'; page: number }
  | null {
  if (data.startsWith(PREFIX_SEL)) {
    const key = data.slice(PREFIX_SEL.length);
    if (!key) return null;
    return { type: 'sel', key };
  }
  if (data.startsWith(PREFIX_PAGE)) {
    const page = Number(data.slice(PREFIX_PAGE.length));
    if (!Number.isFinite(page) || page < 0) return null;
    return { type: 'page', page: Math.floor(page) };
  }
  return null;
}

function etiquetaBoton(f: FacturaPendienteIngreso): string {
  const prov = f.supplier_name ?? 'Proveedor';
  const num = f.invoice_number ?? 'S/N';
  const pref = f.accion === 'confirmar' ? '⏳' : '📦';
  return truncar(`${pref} ${prov} · #${num}`);
}

function buildKeyboard(rows: FacturaPendienteIngreso[], page: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((f) => [
    { text: etiquetaBoton(f), callback_data: callbackSel(f.key) },
  ]);
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: callbackPage(safePage - 1) });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: callbackPage(safePage) });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: callbackPage(safePage + 1) });
    buttons.push(nav);
  }
  return { inline_keyboard: buttons };
}

export async function manejarComandoIngresoFacturaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  page = 0,
): Promise<void> {
  const facturas = await listarFacturasPendientesIngreso(supabase);
  if (!facturas.length) {
    await sendTelegramMessage(
      chatId,
      '✅ No hay facturas precargadas pendientes de ingreso a almacén.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const nTelegram = facturas.filter((f) => f.origen === 'telegram').length;
  const nApp = facturas.filter((f) => f.origen === 'app').length;
  const nWhatsapp = facturas.filter((f) => f.origen === 'whatsapp').length;

  await sendTelegramMessage(
    chatId,
    '📥 <b>Facturas precargadas</b> (Telegram y app)\n\n' +
      `📱 Telegram: <b>${nTelegram}</b> · 🌐 App: <b>${nApp + nWhatsapp}</b>\n` +
      '<i>⏳ confirmar en app · 📦 ingreso directo a almacén</i>',
    { parse_mode: 'HTML', reply_markup: buildKeyboard(facturas, page) },
  );
}

export async function manejarCallbackIngresoFacturaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const parsed = parseCallbackIngresoFactura(params.data);
  if (!parsed) return false;

  if (parsed.type === 'page') {
    await answerCallbackQuery(params.callbackId);
    await manejarComandoIngresoFacturaTelegram(supabase, params.chatId, parsed.page);
    return true;
  }

  const facturas = await listarFacturasPendientesIngreso(supabase);
  const hit = facturas.find((f) => f.key === parsed.key);
  if (!hit) {
    await answerCallbackQuery(params.callbackId, 'Factura no encontrada', true);
    return true;
  }

  if (hit.accion === 'confirmar') {
    await answerCallbackQuery(params.callbackId);
    const link = linkConfirmarCompraTelegram(hit.pendienteId);
    await sendTelegramMessage(
      params.chatId,
      `⏳ <b>Confirmar compra</b>\n` +
        `${hit.supplier_name ?? 'Proveedor'} · #${hit.invoice_number ?? 'S/N'}\n` +
        `${hit.origenLabel}\n\n` +
        `Completa datos y almacén en la app:\n<a href="${link}">Abrir factura</a>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  await answerCallbackQuery(params.callbackId, 'Procesando ingreso…');

  const pendienteId = hit.pendienteId;
  if (!pendienteId) {
    const linkRecepcion = `${baseUrlApp()}/almacen/recepcion?tab=transito`;
    await sendTelegramMessage(
      params.chatId,
      `ℹ️ ${hit.supplier_name ?? 'Proveedor'} · #${hit.invoice_number ?? 'S/N'}\n` +
        `Registra el ingreso desde recepción en la app:\n<a href="${linkRecepcion}">Recepción · tránsito</a>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const resultado = await ingresoAlmacenDesdePendienteCanal(supabase, pendienteId, {
    purchaseInvoiceId: hit.purchase_invoice_id ?? undefined,
  });

  if (!resultado.success) {
    const link = linkConfirmarCompraTelegram(pendienteId);
    await sendTelegramMessage(
      params.chatId,
      `❌ <b>No se pudo ingresar</b>\n` +
        `${hit.supplier_name ?? 'Proveedor'} · #${hit.invoice_number ?? 'S/N'}\n` +
        `${resultado.error ?? 'Error desconocido'}\n\n` +
        `<a href="${link}">Revisar en la app</a>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  const linkMov = `${baseUrlApp()}/almacen/movimientos?vista=ingresos`;
  await sendTelegramMessage(
    params.chatId,
    `✅ <b>Ingreso a almacén registrado</b>\n\n` +
      `${hit.supplier_name ?? 'Proveedor'} · #${hit.invoice_number ?? 'S/N'}\n` +
      `${hit.origenLabel}\n` +
      (resultado.yaExistia ? '\n<i>El stock ya estaba registrado.</i>\n' : '') +
      `\n<a href="${linkMov}">Ver movimientos</a>`,
    { parse_mode: 'HTML' },
  );
  return true;
}

/** @deprecated Usar manejarComandoIngresoFacturaTelegram */
export const manejarComandoEntradaComprasTelegram = manejarComandoIngresoFacturaTelegram;

/** @deprecated Usar manejarCallbackIngresoFacturaTelegram */
export async function manejarCallbackEntradaCompraTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  return manejarCallbackIngresoFacturaTelegram(supabase, params);
}

export function esCallbackEntradaCompra(data: string): boolean {
  return esCallbackIngresoFactura(data);
}

export function esComandoIngresoFactura(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return t === '/ingresofactura' || t === '/ingreso';
}
