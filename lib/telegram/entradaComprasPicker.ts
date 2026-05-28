import type { SupabaseClient } from '@supabase/supabase-js';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { linkConfirmarCompraTelegram } from '@/lib/contabilidad/confirmarCompraDesdeCanal';

const PREFIX_SEL = 'ie:';
const PREFIX_PAGE = 'ip:';
const PAGE_SIZE = 8;

type CompraPendienteIngreso = {
  id: string;
  invoice_number: string | null;
  supplier_name: string | null;
  fecha: string | null;
  purchase_invoice_id: string | null;
};

function truncar(s: string, max = 56): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function callbackSel(compraId: string): string {
  return `${PREFIX_SEL}${compraId}`;
}
function callbackPage(page: number): string {
  return `${PREFIX_PAGE}${page}`;
}

export function esCallbackEntradaCompra(data: string): boolean {
  return data.startsWith(PREFIX_SEL) || data.startsWith(PREFIX_PAGE);
}

export function parseCallbackEntradaCompra(data: string):
  | { type: 'sel'; compraId: string }
  | { type: 'page'; page: number }
  | null {
  if (data.startsWith(PREFIX_SEL)) {
    const compraId = data.slice(PREFIX_SEL.length);
    if (!compraId) return null;
    return { type: 'sel', compraId };
  }
  if (data.startsWith(PREFIX_PAGE)) {
    const page = Number(data.slice(PREFIX_PAGE.length));
    if (!Number.isFinite(page) || page < 0) return null;
    return { type: 'page', page: Math.floor(page) };
  }
  return null;
}

async function cargarComprasPendientesIngreso(
  supabase: SupabaseClient,
): Promise<CompraPendienteIngreso[]> {
  const [{ data: compras, error: cErr }, { data: ingresadas, error: iErr }] = await Promise.all([
    supabase
      .from('contabilidad_compras')
      .select('id,invoice_number,supplier_name,fecha,purchase_invoice_id')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('compras_facturas')
      .select('purchase_invoice_id')
      .not('purchase_invoice_id', 'is', null)
      .limit(1000),
  ]);

  if (cErr) throw new Error(cErr.message);
  if (iErr && iErr.code !== '42P01') throw new Error(iErr.message);

  const setIngresadas = new Set(
    (ingresadas ?? [])
      .map((r) => String(r.purchase_invoice_id ?? '').trim())
      .filter(Boolean),
  );

  return (compras ?? [])
    .filter((c) => {
      const pi = String(c.purchase_invoice_id ?? '').trim();
      return pi && !setIngresadas.has(pi);
    })
    .map((c) => ({
      id: String(c.id),
      invoice_number: c.invoice_number,
      supplier_name: c.supplier_name,
      fecha: c.fecha,
      purchase_invoice_id: c.purchase_invoice_id,
    }));
}

function buildKeyboard(rows: CompraPendienteIngreso[], page: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((c) => [
    {
      text: truncar(
        `#${c.invoice_number ?? 'S/N'} · ${c.supplier_name ?? 'Proveedor'} · ${
          (c.fecha ?? '').slice(0, 10) || 's/f'
        }`,
      ),
      callback_data: callbackSel(c.id),
    },
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

export async function manejarComandoEntradaComprasTelegram(
  supabase: SupabaseClient,
  chatId: string,
  page = 0,
): Promise<void> {
  const compras = await cargarComprasPendientesIngreso(supabase);
  if (!compras.length) {
    await sendTelegramMessage(
      chatId,
      '✅ No hay facturas pendientes por ingresar a almacén.',
      { parse_mode: 'HTML' },
    );
    return;
  }
  await sendTelegramMessage(
    chatId,
    '📥 <b>Facturas cargadas y pendientes de ingreso a almacén</b>\n' +
      '<i>Selecciona una para abrir su flujo de ingreso.</i>',
    { parse_mode: 'HTML', reply_markup: buildKeyboard(compras, page) },
  );
}

export async function manejarCallbackEntradaCompraTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const parsed = parseCallbackEntradaCompra(params.data);
  if (!parsed) return false;

  if (parsed.type === 'page') {
    await answerCallbackQuery(params.callbackId);
    await manejarComandoEntradaComprasTelegram(supabase, params.chatId, parsed.page);
    return true;
  }

  const { data: compra } = await supabase
    .from('contabilidad_compras')
    .select('id,invoice_number,supplier_name,fecha,purchase_invoice_id')
    .eq('id', parsed.compraId)
    .maybeSingle();
  if (!compra?.purchase_invoice_id) {
    await answerCallbackQuery(params.callbackId, 'Compra no válida', true);
    return true;
  }

  const { data: existenteIngreso } = await supabase
    .from('compras_facturas')
    .select('id')
    .eq('purchase_invoice_id', String(compra.purchase_invoice_id))
    .maybeSingle();
  if (existenteIngreso?.id) {
    await answerCallbackQuery(params.callbackId, 'Ya ingresada en almacén', true);
    return true;
  }

  const { data: pend } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id')
    .eq('purchase_invoice_id', String(compra.purchase_invoice_id))
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  await answerCallbackQuery(params.callbackId);
  if (pend?.id) {
    const link = linkConfirmarCompraTelegram(String(pend.id));
    await sendTelegramMessage(
      params.chatId,
      `📦 <b>${compra.supplier_name ?? 'Proveedor'}</b> · Factura #${compra.invoice_number ?? 'S/N'}\n` +
        `Abre para ejecutar <b>Ingreso a almacén</b>:\n<a href="${link}">${link}</a>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  await sendTelegramMessage(
    params.chatId,
    `ℹ️ Factura #${compra.invoice_number ?? 'S/N'} pendiente de ingreso.\n` +
      'No se encontró vínculo Telegram para abrir directo; completa el ingreso desde Compras en la app.',
    { parse_mode: 'HTML' },
  );
  return true;
}

