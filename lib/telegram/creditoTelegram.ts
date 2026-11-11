import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  downloadTelegramFile,
  mimeFromTelegramPath,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import {
  CALLBACK_PAGAR_CREDITO,
  CREDITOS_POR_PAGINA,
  avisoPagoAdminTelegram,
  formatearUsdCorto,
  lineaListaCreditoTelegram,
  textoBotonPagadoCredito,
  paginaCreditos,
  tecladoPagadoCredito as tecladoPagadoCreditoBase,
  type CreditoAbierto,
} from '@/lib/contabilidad/creditoPagos';
import {
  cargarCreditoAbierto,
  exigirPermisoCreditoTelegram,
  listarCreditosAbiertos,
  registrarPagoCredito,
  subirComprobanteCredito,
} from '@/lib/contabilidad/creditoPagosDb';
import { listarAdministradoresSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { resolverChatAdministracion } from '@/lib/telegram/chatAdministracion';

export const PREFIX_CREDITO = 'cr:';
export const FLUJO_CREDITO_PAGO = 'credito_pago';

const CB_LISTA = 'cr:l:';
const CB_PAGAR = CALLBACK_PAGAR_CREDITO;
const CB_OMITIR = 'cr:o:';
const CB_OK = 'cr:ok:';
const CB_CANCELAR = 'cr:x';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esCallbackCredito(data: string): boolean {
  return data.startsWith(PREFIX_CREDITO);
}

export function esFlujoCreditoPago(estado: { contexto?: string; metadata?: Record<string, unknown> }): boolean {
  if (estado.contexto === 'credito_pago') return true;
  return String(estado.metadata?.flujo ?? '') === FLUJO_CREDITO_PAGO;
}

type MetaCredito = {
  flujo?: string;
  paso?: 'comprobante' | 'confirmar';
  purchase_invoice_id?: string;
  referencia?: string | null;
  monto_usd?: number | null;
  comprobante_path?: string | null;
  comprobante_file_name?: string | null;
  comprobante_mime?: string | null;
};

function metaCredito(estado: { metadata?: Record<string, unknown> }): MetaCredito {
  return (estado.metadata ?? {}) as MetaCredito;
}

function tecladoLista(items: CreditoAbierto[], page: number, totalPages: number) {
  const filas: Array<Array<{ text: string; callback_data: string }>> = items.map((c) => [
    { text: textoBotonPagadoCredito(c), callback_data: `${CB_PAGAR}${c.purchaseInvoiceId}` },
  ]);
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (page > 0) nav.push({ text: '◀ Anterior', callback_data: `${CB_LISTA}${page - 1}` });
    nav.push({ text: `${page + 1}/${totalPages}`, callback_data: `${CB_LISTA}${page}` });
    if (page < totalPages - 1) nav.push({ text: 'Siguiente ▶', callback_data: `${CB_LISTA}${page + 1}` });
    filas.push(nav);
  }
  return { inline_keyboard: filas };
}

function tecladoComprobante(purchaseInvoiceId: string) {
  return {
    inline_keyboard: [
      [{ text: 'Omitir', callback_data: `${CB_OMITIR}${purchaseInvoiceId}` }],
      [{ text: 'Cancelar', callback_data: CB_CANCELAR }],
    ],
  };
}

function tecladoConfirmar(purchaseInvoiceId: string) {
  return {
    inline_keyboard: [
      [{ text: 'Confirmar pago', callback_data: `${CB_OK}${purchaseInvoiceId}` }],
      [{ text: 'Cancelar', callback_data: CB_CANCELAR }],
    ],
  };
}

function mensajeLista(items: CreditoAbierto[], page: number, total: number, totalPages: number): string {
  if (!items.length && total === 0) {
    return '💳 <b>Sin créditos abiertos</b> en sus entidades.';
  }
  const inicio = page * CREDITOS_POR_PAGINA;
  const lineas = items.map((c, i) => lineaListaCreditoTelegram(c, inicio + i + 1));
  return (
    `💳 <b>Créditos abiertos</b> (${total})\n` +
    `<i>Ordenados por vencimiento</i>\n\n` +
    lineas.join('\n') +
    (totalPages > 1 ? `\n\nPágina ${page + 1}/${totalPages}` : '')
  );
}

export async function enviarListaCreditosTelegram(
  supabase: SupabaseClient,
  chatId: string,
  page = 0,
): Promise<void> {
  const perm = await exigirPermisoCreditoTelegram(supabase, chatId);
  if (!perm.ok) {
    await sendTelegramMessage(chatId, perm.error, { parse_mode: 'HTML' });
    return;
  }
  const todos = await listarCreditosAbiertos(supabase, perm.alcance);
  const { slice, page: safe, totalPages } = paginaCreditos(todos, page);
  await setTelegramContexto(supabase, chatId, {
    contexto: 'menu',
    metadata: {},
    reemplazarMetadata: true,
  });
  await sendTelegramMessage(chatId, mensajeLista(slice, safe, todos.length, totalPages), {
    parse_mode: 'HTML',
    reply_markup: slice.length ? tecladoLista(slice, safe, totalPages) : undefined,
  });
}

export async function manejarComandoCreditoTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await enviarListaCreditosTelegram(supabase, chatId, 0);
}

async function pedirComprobante(
  supabase: SupabaseClient,
  chatId: string,
  credito: CreditoAbierto,
  extra?: Partial<MetaCredito>,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'credito_pago',
    metadata: {
      flujo: FLUJO_CREDITO_PAGO,
      paso: 'comprobante',
      purchase_invoice_id: credito.purchaseInvoiceId,
      monto_usd: extra?.monto_usd ?? credito.saldoUsd,
      referencia: extra?.referencia ?? null,
      comprobante_path: extra?.comprobante_path ?? null,
      comprobante_file_name: extra?.comprobante_file_name ?? null,
      comprobante_mime: extra?.comprobante_mime ?? null,
    },
    reemplazarMetadata: true,
  });
  await sendTelegramMessage(
    chatId,
    `💳 <b>${escHtml(credito.proveedor)}</b> #${escHtml(credito.numeroFactura)}\n` +
      `Saldo US$${formatearUsdCorto(credito.saldoUsd)}\n\n` +
      `Envíe referencia o foto del comprobante, o pulse <b>Omitir</b>.`,
    { parse_mode: 'HTML', reply_markup: tecladoComprobante(credito.purchaseInvoiceId) },
  );
}

async function pedirConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  credito: CreditoAbierto,
  meta: MetaCredito,
): Promise<void> {
  const monto = Number(meta.monto_usd) > 0 ? Number(meta.monto_usd) : credito.saldoUsd;
  await setTelegramContexto(supabase, chatId, {
    contexto: 'credito_pago',
    metadata: { ...meta, flujo: FLUJO_CREDITO_PAGO, paso: 'confirmar', purchase_invoice_id: credito.purchaseInvoiceId },
    reemplazarMetadata: true,
  });
  const ref = meta.referencia?.trim();
  const foto = meta.comprobante_path ? 'sí' : 'no';
  await sendTelegramMessage(
    chatId,
    `¿Marcar pagado <b>${escHtml(credito.proveedor)}</b> #${escHtml(credito.numeroFactura)}` +
      ` · US$${formatearUsdCorto(monto)}?\n` +
      `Referencia: <i>${escHtml(ref || '—')}</i> · Comprobante: ${foto}`,
    { parse_mode: 'HTML', reply_markup: tecladoConfirmar(credito.purchaseInvoiceId) },
  );
}

export async function manejarCallbackCreditoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; fromName?: string },
): Promise<boolean> {
  if (!esCallbackCredito(params.data)) return false;
  const perm = await exigirPermisoCreditoTelegram(supabase, params.chatId);
  if (!perm.ok) {
    await answerCallbackQuery(params.callbackId, 'Sin permiso', true);
    await sendTelegramMessage(params.chatId, perm.error, { parse_mode: 'HTML' });
    return true;
  }

  if (params.data === CB_CANCELAR) {
    await answerCallbackQuery(params.callbackId, 'Cancelado');
    await setTelegramContexto(supabase, params.chatId, {
      contexto: 'menu',
      metadata: {},
      reemplazarMetadata: true,
    });
    await sendTelegramMessage(params.chatId, '↩️ Pago cancelado. /credito para la lista.', { parse_mode: 'HTML' });
    return true;
  }

  if (params.data.startsWith(CB_LISTA)) {
    const page = Number(params.data.slice(CB_LISTA.length));
    await answerCallbackQuery(params.callbackId);
    await enviarListaCreditosTelegram(supabase, params.chatId, Number.isFinite(page) ? page : 0);
    return true;
  }

  const idFrom = (prefix: string) => params.data.slice(prefix.length).trim();

  if (params.data.startsWith(CB_PAGAR)) {
    const id = idFrom(CB_PAGAR);
    if (!UUID_RE.test(id)) {
      await answerCallbackQuery(params.callbackId, 'Factura inválida', true);
      return true;
    }
    const credito = await cargarCreditoAbierto(supabase, id, perm.alcance);
    if (!credito) {
      await answerCallbackQuery(params.callbackId, 'Ya no está abierto', true);
      await sendTelegramMessage(params.chatId, 'Ese crédito ya no está abierto.', { parse_mode: 'HTML' });
      return true;
    }
    await answerCallbackQuery(params.callbackId);
    await pedirComprobante(supabase, params.chatId, credito);
    return true;
  }

  if (params.data.startsWith(CB_OMITIR)) {
    const id = idFrom(CB_OMITIR);
    const credito = await cargarCreditoAbierto(supabase, id, perm.alcance);
    if (!credito) {
      await answerCallbackQuery(params.callbackId, 'Ya no está abierto', true);
      return true;
    }
    const estado = await getTelegramEstado(supabase, params.chatId);
    await answerCallbackQuery(params.callbackId, 'Sin comprobante');
    await pedirConfirmacion(supabase, params.chatId, credito, {
      ...metaCredito(estado),
      purchase_invoice_id: id,
      monto_usd: credito.saldoUsd,
    });
    return true;
  }

  if (params.data.startsWith(CB_OK)) {
    const id = idFrom(CB_OK);
    const credito = await cargarCreditoAbierto(supabase, id, perm.alcance);
    if (!credito) {
      await answerCallbackQuery(params.callbackId, 'Ya no está abierto', true);
      return true;
    }
    const estado = await getTelegramEstado(supabase, params.chatId);
    const meta = metaCredito(estado);
    try {
      const r = await registrarPagoCredito(supabase, perm.alcance, {
        purchaseInvoiceId: id,
        montoUsd: meta.monto_usd ?? credito.saldoUsd,
        referencia: meta.referencia,
        nombre: perm.usuario.nombre || params.fromName || 'Telegram',
        telegramChatId: params.chatId,
        comprobante: meta.comprobante_path
          ? {
              path: meta.comprobante_path,
              fileName: meta.comprobante_file_name || 'comprobante.jpg',
              mimeType: meta.comprobante_mime || 'image/jpeg',
            }
          : null,
      });
      await answerCallbackQuery(params.callbackId, 'Pagado');
      await setTelegramContexto(supabase, params.chatId, {
        contexto: 'menu',
        metadata: {},
        reemplazarMetadata: true,
      });
      await sendTelegramMessage(
        params.chatId,
        `✅ Pagado: <b>${escHtml(credito.proveedor)}</b> #${escHtml(credito.numeroFactura)}` +
          ` · US$${formatearUsdCorto(r.montoUsd)}` +
          (r.quedaPagado ? '' : ` · saldo US$${formatearUsdCorto(r.credito.saldoUsd)}`),
        { parse_mode: 'HTML' },
      );
      try {
        await avisarPagoCreditoAdmin(supabase, {
          proveedor: credito.proveedor,
          numero: credito.numeroFactura,
          montoUsd: r.montoUsd,
          nombre: perm.usuario.nombre || params.fromName || 'Telegram',
          chatOrigen: params.chatId,
        });
      } catch (e) {
        console.warn('[credito] aviso admin', e);
      }
    } catch (e) {
      await answerCallbackQuery(params.callbackId, 'No se pudo registrar', true);
      await sendTelegramMessage(
        params.chatId,
        `❌ ${e instanceof Error ? e.message : 'No se pudo registrar el pago.'}`,
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  await answerCallbackQuery(params.callbackId);
  return true;
}

export async function manejarTextoCreditoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoCreditoPago(estado)) return false;
  const meta = metaCredito(estado);
  if (meta.paso !== 'comprobante' || !meta.purchase_invoice_id) return false;
  const perm = await exigirPermisoCreditoTelegram(supabase, chatId);
  if (!perm.ok) {
    await sendTelegramMessage(chatId, perm.error, { parse_mode: 'HTML' });
    return true;
  }
  const credito = await cargarCreditoAbierto(supabase, meta.purchase_invoice_id, perm.alcance);
  if (!credito) {
    await sendTelegramMessage(chatId, 'Ese crédito ya no está abierto.', { parse_mode: 'HTML' });
    return true;
  }
  await pedirConfirmacion(supabase, chatId, credito, {
    ...meta,
    referencia: texto.trim().slice(0, 200),
  });
  return true;
}

export async function manejarFotoCreditoTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  fileId: string;
  mimeType?: string;
  fileName?: string;
}): Promise<boolean> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoCreditoPago(estado)) return false;
  const meta = metaCredito(estado);
  if (meta.paso !== 'comprobante' || !meta.purchase_invoice_id) return false;

  const perm = await exigirPermisoCreditoTelegram(params.supabase, params.chatId);
  if (!perm.ok) {
    await sendTelegramMessage(params.chatId, perm.error, { parse_mode: 'HTML' });
    return true;
  }
  const credito = await cargarCreditoAbierto(params.supabase, meta.purchase_invoice_id, perm.alcance);
  if (!credito) {
    await sendTelegramMessage(params.chatId, 'Ese crédito ya no está abierto.', { parse_mode: 'HTML' });
    return true;
  }

  try {
    const { buffer, filePath } = await downloadTelegramFile(params.fileId);
    const mime = params.mimeType || mimeFromTelegramPath(filePath);
    const fileName = params.fileName || filePath.split('/').pop() || 'comprobante.jpg';
    const subida = await subirComprobanteCredito(params.supabase, credito.purchaseInvoiceId, {
      buffer,
      mimeType: mime,
      fileName,
    });
    await pedirConfirmacion(params.supabase, params.chatId, credito, {
      ...meta,
      comprobante_path: subida.path,
      comprobante_file_name: subida.fileName,
      comprobante_mime: subida.mimeType,
    });
  } catch (e) {
    await sendTelegramMessage(
      params.chatId,
      `❌ No se pudo guardar el comprobante. ${e instanceof Error ? e.message : ''} Pulse Omitir si no tiene foto.`,
      { parse_mode: 'HTML', reply_markup: tecladoComprobante(credito.purchaseInvoiceId) },
    );
  }
  return true;
}

export async function avisarPagoCreditoAdmin(
  supabase: SupabaseClient,
  opts: { proveedor: string; numero: string; montoUsd: number; nombre: string; chatOrigen: string },
): Promise<void> {
  const texto = avisoPagoAdminTelegram(opts);
  const destinos = new Set<string>();
  try {
    for (const a of await listarAdministradoresSistemaTelegram(supabase)) {
      if (a.chatId && a.chatId !== opts.chatOrigen) destinos.add(a.chatId);
    }
  } catch (e) {
    console.warn('[credito] admins telegram', e);
  }
  try {
    const adm = await resolverChatAdministracion(supabase);
    if (adm.chatId && adm.chatId !== opts.chatOrigen) destinos.add(adm.chatId);
  } catch (e) {
    console.warn('[credito] chat administración', e);
  }
  for (const chat of destinos) {
    try {
      await sendTelegramMessage(chat, texto, {
        parse_mode: 'HTML',
        contextoLogEspejo: '[Contabilidad · crédito pagado]',
      });
    } catch (e) {
      console.warn('[credito] aviso admin', chat, e);
    }
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function tecladoPagadoCredito(c: CreditoAbierto) {
  return tecladoPagadoCreditoBase(c);
}
