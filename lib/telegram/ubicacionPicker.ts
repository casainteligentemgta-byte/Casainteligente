import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import {
  asegurarUbicacionObra,
  etiquetaUbicacionSelector,
  labelUbicacionOpcion,
  listarUbicacionesParaSelector,
  resolverProyectoDestinoDesdeUbicacionAlmacen,
} from '@/lib/almacen/ubicacionesInventario';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { confirmarCompraDesdeCanal } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import {
  mensajeCompradorFacturaConfirmadaHtml,
  resumenFacturaCompradorHtml,
  tecladoFacturaRegistradaOk,
} from '@/lib/telegram/mensajesFactura';
import { procuraIdDesdeMetadataFactura } from '@/lib/telegram/facturaCompradorManualTelegram';
import {
  esNotaEntregaExtracted,
  mensajeNotaEntregaFinalizada,
} from '@/lib/telegram/notaEntregaRegistro';
import type { UbicacionInventario } from '@/types/inventario-obra';

const PREFIX_SEL = 'ub:';
const PREFIX_PAGE = 'up:';

function truncar(s: string, max = 60): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function parseCallbackUbicacion(data: string):
  | { type: 'sel'; ubicacionId: string }
  | { type: 'page'; page: number }
  | null {
  if (data.startsWith(PREFIX_SEL)) {
    const ubicacionId = data.slice(PREFIX_SEL.length);
    if (!ubicacionId) return null;
    return { type: 'sel', ubicacionId };
  }
  if (data.startsWith(PREFIX_PAGE)) {
    const page = Number(data.slice(PREFIX_PAGE.length));
    if (!Number.isFinite(page) || page < 0) return null;
    return { type: 'page', page: Math.floor(page) };
  }
  return null;
}

function indentNivel(u: UbicacionInventario, flat: UbicacionInventario[]): number {
  let n = 0;
  let pid = u.ubicacion_padre_id;
  const byId = new Map(flat.map((x) => [x.id, x]));
  while (pid && n < 5) {
    n += 1;
    pid = byId.get(pid)?.ubicacion_padre_id;
  }
  return n;
}

function buildKeyboard(
  ubicaciones: UbicacionInventario[],
  page: number,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(ubicaciones.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = ubicaciones.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const rows: Array<Array<{ text: string; callback_data: string }>> = slice.map((u) => [
    {
      text: truncar(etiquetaUbicacionSelector(u, indentNivel(u, ubicaciones))),
      callback_data: `${PREFIX_SEL}${u.id}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) {
      nav.push({ text: '◀', callback_data: `${PREFIX_PAGE}${safePage - 1}` });
    }
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX_PAGE}${safePage}` });
    if (safePage < totalPages - 1) {
      nav.push({ text: '▶', callback_data: `${PREFIX_PAGE}${safePage + 1}` });
    }
    rows.push(nav);
  }

  return { inline_keyboard: rows };
}

function etiquetaAlmacenFacturaComprador(u: UbicacionInventario): string {
  const base = labelUbicacionOpcion(u);
  const proy = u.proyecto?.nombre?.trim();
  return proy ? `${base} · ${proy}` : base;
}

function buildKeyboardAlmacenesFactura(
  ubicaciones: UbicacionInventario[],
  page: number,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(ubicaciones.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = ubicaciones.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const rows: Array<Array<{ text: string; callback_data: string }>> = slice.map((u) => [
    {
      text: truncar(etiquetaAlmacenFacturaComprador(u)),
      callback_data: `${PREFIX_SEL}${u.id}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) {
      nav.push({ text: '◀', callback_data: `${PREFIX_PAGE}${safePage - 1}` });
    }
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX_PAGE}${safePage}` });
    if (safePage < totalPages - 1) {
      nav.push({ text: '▶', callback_data: `${PREFIX_PAGE}${safePage + 1}` });
    }
    rows.push(nav);
  }

  return { inline_keyboard: rows };
}

/** Tras moneda y forma de pago: elige almacén de ingreso (sin paso entidad/obra). */
export async function enviarPickerAlmacenesFacturaCompradorTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  page = 0,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    metadata: { flujo: 'factura_compra_almacen' },
  });

  const ubicaciones = await listarUbicacionesParaSelector(supabase, {
    soloAlmacenes: true,
  });

  if (!ubicaciones.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay almacenes configurados. Cree depósitos en Almacén → Maestros.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const keyboard = buildKeyboardAlmacenesFactura(ubicaciones, page);

  await sendTelegramMessage(
    chatId,
    `📦 <b>¿A qué almacén irá el material?</b>\n\n<i>Elija el depósito de ingreso.</i>`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}

export async function enviarPickerUbicacionesTelegram(
  supabase: SupabaseClient,
  chatId: string,
  params: {
    pendingId: string;
    proyectoId: string;
    nombreObra: string;
    page?: number;
    esNotaEntrega?: boolean;
  },
): Promise<void> {
  await asegurarUbicacionObra(supabase, params.proyectoId, params.nombreObra);

  await setTelegramContexto(supabase, chatId, {
    contexto: params.esNotaEntrega ? 'entrada_obra' : 'factura',
    pending_factura_id: params.pendingId,
    proyecto_id: params.proyectoId,
    metadata: {
      factura_picker_proyecto_id: params.proyectoId,
      factura_picker_nombre_obra: params.nombreObra,
      es_nota_entrega: params.esNotaEntrega ?? false,
      ...(params.esNotaEntrega ? { flujo: 'nota_entrega' as const } : {}),
    },
  });

  const ubicaciones = await listarUbicacionesParaSelector(supabase, {
    proyectoId: params.proyectoId,
    soloAlmacenes: true,
  });

  if (!ubicaciones.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay almacenes configurados. Aplique migraciones 180–181 o cree ubicaciones en la app.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const keyboard = buildKeyboard(ubicaciones, params.page ?? 0);

  await sendTelegramMessage(
    chatId,
    `📦 <b>¿A qué almacén será despachada?</b>\nObra: <b>${params.nombreObra}</b>`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}

export async function manejarCallbackUbicacionTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const parsed = parseCallbackUbicacion(params.data);
  if (!parsed) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  const pendingId = estado.pending_factura_id;
  const flujoAlmacenDirecto =
    String(estado.metadata?.flujo ?? '') === 'factura_compra_almacen';
  let proyectoId =
    estado.proyecto_id ?? String(estado.metadata?.factura_picker_proyecto_id ?? '');
  let nombreObra = String(estado.metadata?.factura_picker_nombre_obra ?? 'Obra');

  if (!pendingId) {
    await answerCallbackQuery(params.callbackId, 'Sin factura pendiente', true);
    return true;
  }

  if (parsed.type === 'page') {
    await answerCallbackQuery(params.callbackId);
    if (flujoAlmacenDirecto) {
      await enviarPickerAlmacenesFacturaCompradorTelegram(
        supabase,
        params.chatId,
        pendingId,
        parsed.page,
      );
    } else {
      await enviarPickerUbicacionesTelegram(supabase, params.chatId, {
        pendingId,
        proyectoId,
        nombreObra,
        page: parsed.page,
      });
    }
    return true;
  }

  const { data: ubi } = await supabase
    .from('inv_ubicaciones')
    .select('id, nombre, tipo')
    .eq('id', parsed.ubicacionId)
    .maybeSingle();

  if (!ubi) {
    await answerCallbackQuery(params.callbackId, 'Ubicación no encontrada', true);
    return true;
  }

  let imputacionEntidad = false;
  let entidadId: string | null = null;

  if (flujoAlmacenDirecto || !proyectoId) {
    try {
      const destino = await resolverProyectoDestinoDesdeUbicacionAlmacen(
        supabase,
        parsed.ubicacionId,
      );
      proyectoId = destino.proyectoId ?? '';
      nombreObra = destino.nombreObra;
      imputacionEntidad = destino.imputacionEntidad;
      entidadId = destino.entidadId;
    } catch (e) {
      const det = e instanceof Error ? e.message : 'No se pudo vincular el almacén';
      await answerCallbackQuery(params.callbackId, det.slice(0, 180), true);
      return true;
    }
  }

  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      proyecto_id: proyectoId || null,
      entidad_id: entidadId,
      ubicacion_destino_id: parsed.ubicacionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);

  if (error) {
    await answerCallbackQuery(params.callbackId, 'Error al guardar', true);
    return true;
  }

  await answerCallbackQuery(params.callbackId, String(ubi.nombre));

  const esNotaEntrega = Boolean(estado.metadata?.es_nota_entrega);
  const { data: pendiente } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted')
    .eq('id', pendingId)
    .maybeSingle();
  const extracted = (pendiente?.extracted ?? {}) as Record<string, unknown>;
  const notaEntrega = esNotaEntrega || esNotaEntregaExtracted(extracted);

  if (notaEntrega) {
    const proveedor = String(extracted.supplier_name ?? 'Proveedor');
    const nItems = Array.isArray(extracted.items) ? extracted.items.length : 0;
    await setTelegramContexto(supabase, params.chatId, {
      contexto: 'menu',
      pending_factura_id: null,
      metadata: {},
    });
    await sendTelegramMessage(
      params.chatId,
      mensajeNotaEntregaFinalizada({
        proveedor,
        ubicacionNombre: String(ubi.nombre),
        nItems,
        pendingId,
      }),
      { parse_mode: 'HTML' },
    );
    return true;
  }

  let textoFinal = resumenFacturaCompradorHtml(extracted);

  const puedeConfirmar = imputacionEntidad ? Boolean(entidadId) : Boolean(proyectoId);

  if (puedeConfirmar) {
    try {
      const estadoPrev = await getTelegramEstado(supabase, params.chatId);
      const procuraId = procuraIdDesdeMetadataFactura(estadoPrev);
      await confirmarCompraDesdeCanal(supabase, {
        pendingId,
        proyectoId: proyectoId || '',
        ubicacionDestinoId: parsed.ubicacionId,
        entidadId: entidadId ?? undefined,
        imputacionEntidad,
        procuraId,
      });
      await setTelegramContexto(supabase, params.chatId, {
        contexto: 'menu',
        pending_factura_id: null,
        metadata: {},
      });
      textoFinal = mensajeCompradorFacturaConfirmadaHtml(
        imputacionEntidad ? 'entidad' : 'obra',
        extracted,
      );
    } catch (e) {
      const det = e instanceof Error ? e.message : 'Error al registrar en Contabilidad';
      textoFinal =
        `⚠️ <b>No se pudo registrar en Contabilidad</b>\n<i>${det.slice(0, 280)}</i>\n\n` +
        resumenFacturaCompradorHtml(extracted);
    }
  }

  await sendTelegramMessage(params.chatId, textoFinal, {
    parse_mode: 'HTML',
    reply_markup: tecladoFacturaRegistradaOk(imputacionEntidad ? 'entidad' : 'obra'),
  });
  return true;
}

export function esCallbackUbicacion(data: string): boolean {
  return data.startsWith(PREFIX_SEL) || data.startsWith(PREFIX_PAGE);
}
