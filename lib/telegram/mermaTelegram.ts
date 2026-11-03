import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ETIQUETA_MOTIVO_MERMA,
  MOTIVOS_MERMA,
  esMotivoMerma,
  registrarMermaAlmacen,
  type MotivoMerma,
} from '@/lib/almacen/registrarMermaAlmacen';
import {
  etiquetaUbicacionSelector,
  listarUbicacionesParaSelector,
} from '@/lib/almacen/ubicacionesInventario';
import { listarStockUbicacionEgreso } from '@/lib/almacen/registrarEgresoCampo';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import { resolverChatAdministracion } from '@/lib/telegram/chatAdministracion';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { SUFIJO_CALLBACK_FOTO_CAMARA } from '@/lib/telegram/tecladoSoporteFotoTelegram';
import {
  MENSAJE_MERMA_SOLO_DEPOSITARIO,
  puedeRegistrarMermaTelegram,
} from '@/lib/telegram/permisosAlmacenTelegram';
import { MENSAJE_INICIO_SALIDA_MERMA } from '@/lib/telegram/mensajesSalidaTelegram';

export const FLUJO_MERMA_ALMACEN = 'merma_almacen';
export const PREFIX_MERMA = 'mr:';

export type PasoMermaTelegram =
  | 'almacen'
  | 'producto'
  | 'cantidad'
  | 'motivo'
  | 'foto'
  | 'confirmar';

export type MetadataMermaTelegram = {
  flujo?: string;
  paso?: PasoMermaTelegram;
  origen_id?: string;
  origen_nombre?: string;
  producto_id?: string;
  producto_nombre?: string;
  unidad?: string;
  stock?: number;
  cantidad?: number;
  motivo?: MotivoMerma;
  foto_storage_path?: string;
  foto_url?: string;
};

const PAGE_SIZE = 6;
const BUCKET_FOTOS = 'ci-proyectos-media';

function truncar(s: string, max = 54): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function meta(estado: TelegramEstado): MetadataMermaTelegram {
  return (estado.metadata ?? {}) as MetadataMermaTelegram;
}

export function esFlujoMermaTelegram(estado: TelegramEstado): boolean {
  return estado.contexto === 'merma_almacen' || meta(estado).flujo === FLUJO_MERMA_ALMACEN;
}

export function esCallbackMermaTelegram(data: string): boolean {
  return data.startsWith(PREFIX_MERMA);
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: Partial<MetadataMermaTelegram>,
): Promise<TelegramEstado> {
  return setTelegramContexto(supabase, chatId, {
    metadata: { ...meta(estado), ...patch },
  });
}

async function exigirPermiso(
  supabase: SupabaseClient,
  chatId: string,
  callbackId?: string,
): Promise<boolean> {
  if (await puedeRegistrarMermaTelegram(supabase, chatId)) return true;
  if (callbackId) {
    await answerCallbackQuery(callbackId, MENSAJE_MERMA_SOLO_DEPOSITARIO.slice(0, 180), true);
  }
  await sendTelegramMessage(chatId, MENSAJE_MERMA_SOLO_DEPOSITARIO);
  return false;
}

export async function manejarComandoMermaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  if (!(await exigirPermiso(supabase, chatId))) return;
  await setTelegramContexto(supabase, chatId, {
    contexto: 'merma_almacen',
    proyecto_id: null,
    metadata: { flujo: FLUJO_MERMA_ALMACEN, paso: 'almacen' },
    reemplazarMetadata: true,
  });
  await sendTelegramMessage(chatId, MENSAJE_INICIO_SALIDA_MERMA, { parse_mode: 'HTML' });
  await enviarPickerAlmacen(supabase, chatId, 0);
}

async function enviarPickerAlmacen(
  supabase: SupabaseClient,
  chatId: string,
  page: number,
): Promise<void> {
  const almacenes = await listarUbicacionesParaSelector(supabase, { soloAlmacenes: true });
  if (!almacenes.length) {
    await sendTelegramMessage(chatId, '⚠️ No hay almacenes. Avise al administrador.');
    return;
  }
  const totalPages = Math.max(1, Math.ceil(almacenes.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = almacenes.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const rows: Array<Array<{ text: string; callback_data: string }>> = slice.map((u) => [
    {
      text: truncar(etiquetaUbicacionSelector(u)),
      callback_data: `${PREFIX_MERMA}ub:${u.id}`,
    },
  ]);
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX_MERMA}ubp:${safePage - 1}` });
    nav.push({
      text: `${safePage + 1}/${totalPages}`,
      callback_data: `${PREFIX_MERMA}ubp:${safePage}`,
    });
    if (safePage < totalPages - 1) {
      nav.push({ text: '▶', callback_data: `${PREFIX_MERMA}ubp:${safePage + 1}` });
    }
    rows.push(nav);
  }
  await sendTelegramMessage(chatId, '🏭 <b>¿De qué almacén sale?</b>', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: rows },
  });
}

async function enviarPickerProducto(
  supabase: SupabaseClient,
  chatId: string,
  origenId: string,
  page = 0,
): Promise<void> {
  const stock = await listarStockUbicacionEgreso(supabase, origenId);
  if (!stock.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Este almacén no tiene stock. Elija otro o use /salida.',
    );
    return;
  }
  const totalPages = Math.max(1, Math.ceil(stock.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = stock.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const rows: Array<Array<{ text: string; callback_data: string }>> = slice.map((s) => [
    {
      text: truncar(`${s.nombre} (${s.cantidad_disponible} ${s.unidad})`),
      callback_data: `${PREFIX_MERMA}mat:${s.material_id}`,
    },
  ]);
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX_MERMA}matp:${safePage - 1}` });
    nav.push({
      text: `${safePage + 1}/${totalPages}`,
      callback_data: `${PREFIX_MERMA}matp:${safePage}`,
    });
    if (safePage < totalPages - 1) {
      nav.push({ text: '▶', callback_data: `${PREFIX_MERMA}matp:${safePage + 1}` });
    }
    rows.push(nav);
  }
  await sendTelegramMessage(chatId, '📦 <b>¿Qué producto da de baja?</b>', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: rows },
  });
}

async function enviarPickerMotivo(chatId: string): Promise<void> {
  await sendTelegramMessage(chatId, '❓ <b>¿Por qué se da de baja?</b>', {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: MOTIVOS_MERMA.map((m) => [
        { text: ETIQUETA_MOTIVO_MERMA[m], callback_data: `${PREFIX_MERMA}mo:${m}` },
      ]),
    },
  });
}

async function pedirFoto(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '📷 Foto <b>opcional</b> del material. Envíela o pulse Omitir.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❓ ¿Cómo envío la foto?', callback_data: `${PREFIX_MERMA}${SUFIJO_CALLBACK_FOTO_CAMARA}` }],
          [
            { text: '✅ Listo con fotos', callback_data: `${PREFIX_MERMA}foto:done` },
            { text: '⏭ Omitir fotos', callback_data: `${PREFIX_MERMA}foto:skip` },
          ],
        ],
      },
    },
  );
}

async function enviarResumen(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  const motivo = m.motivo ? ETIQUETA_MOTIVO_MERMA[m.motivo] : '—';
  const foto = m.foto_storage_path?.trim() ? 'sí' : 'no';
  await sendTelegramMessage(
    chatId,
    '⚠️ <b>Confirmar baja</b>\n\n' +
      `Almacén: ${m.origen_nombre ?? '—'}\n` +
      `Producto: ${m.producto_nombre ?? '—'}\n` +
      `Cantidad: <b>${m.cantidad ?? 0}</b> ${m.unidad ?? ''}\n` +
      `Motivo: ${motivo}\n` +
      `Foto: ${foto}\n\n` +
      'Se descuenta del stock y se avisa a administración.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔒 Confirmar baja', callback_data: `${PREFIX_MERMA}ok` },
            { text: '❌ Cancelar', callback_data: `${PREFIX_MERMA}x` },
          ],
        ],
      },
    },
  );
}

async function notificarAdminMerma(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    origenNombre: string;
    productoNombre: string;
    cantidad: number;
    unidad: string;
    motivo: MotivoMerma;
    codigo: string;
  },
): Promise<void> {
  const dest = await resolverChatAdministracion(supabase);
  const canal =
    dest.chatId ||
    process.env.TELEGRAM_ADMIN_CHANNEL_ID?.trim() ||
    process.env.TELEGRAM_ALMACEN_CHAT_IDS?.split(/[,;\s]+/).map((s) => s.trim()).find(Boolean) ||
    null;
  if (!canal || canal === params.chatId) return;
  await sendTelegramMessage(
    canal,
    '⚠️ <b>Baja de almacén</b>\n\n' +
      `${params.productoNombre} × <b>${params.cantidad}</b> ${params.unidad}\n` +
      `${params.origenNombre}\n` +
      `Motivo: ${ETIQUETA_MOTIVO_MERMA[params.motivo]}\n` +
      `Código: <code>${params.codigo}</code>\n` +
      `Depositario: <code>${params.chatId}</code>`,
    { parse_mode: 'HTML' },
  );
}

async function ejecutarMerma(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  if (!m.origen_id || !m.producto_id || !m.cantidad || !m.motivo) {
    await sendTelegramMessage(chatId, '❌ Datos incompletos. Empiece de nuevo con /salida.');
    return;
  }
  const resultado = await registrarMermaAlmacen(supabase, {
    origenUbicacionId: m.origen_id,
    materialId: m.producto_id,
    materialNombre: m.producto_nombre,
    cantidad: m.cantidad,
    motivo: m.motivo,
    fotoStoragePath: m.foto_storage_path,
    fotoUrl: m.foto_url,
    chatId,
  });
  await setTelegramContexto(supabase, chatId, {
    contexto: 'menu',
    metadata: {},
    reemplazarMetadata: true,
  });
  if (!resultado.ok) {
    await sendTelegramMessage(chatId, `❌ ${resultado.error}\nUse /salida para reintentar.`);
    return;
  }
  await sendTelegramMessage(
    chatId,
    '✅ <b>Baja registrada</b>\n\n' +
      `${m.producto_nombre}: <b>${m.cantidad}</b> ${m.unidad ?? ''}\n` +
      `${resultado.origenNombre} → ${resultado.destinoNombre}\n` +
      `Código: <code>${resultado.codigo}</code>`,
    { parse_mode: 'HTML' },
  );
  try {
    await notificarAdminMerma(supabase, {
      chatId,
      origenNombre: resultado.origenNombre,
      productoNombre: m.producto_nombre ?? 'Material',
      cantidad: m.cantidad,
      unidad: m.unidad ?? '',
      motivo: m.motivo,
      codigo: resultado.codigo,
    });
  } catch (e) {
    console.warn('[merma] aviso admin', e);
  }
}

export async function manejarCallbackMermaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackMermaTelegram(params.data)) return false;
  if (!(await exigirPermiso(supabase, params.chatId, params.callbackId))) return true;

  const raw = params.data.slice(PREFIX_MERMA.length);
  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoMermaTelegram(estado) && raw !== 'x') {
    await answerCallbackQuery(params.callbackId, 'Use /salida y elija Deterioro / merma.', true);
    return true;
  }

  if (raw === 'x') {
    await answerCallbackQuery(params.callbackId, 'Cancelado');
    await setTelegramContexto(supabase, params.chatId, {
      contexto: 'menu',
      metadata: {},
      reemplazarMetadata: true,
    });
    await sendTelegramMessage(params.chatId, '↩️ Baja cancelada. /salida para otro movimiento.');
    return true;
  }

  if (raw.startsWith('ubp:')) {
    await answerCallbackQuery(params.callbackId);
    await enviarPickerAlmacen(supabase, params.chatId, Number(raw.slice(4)) || 0);
    return true;
  }

  if (raw.startsWith('ub:')) {
    const id = raw.slice(3);
    const { data: ubi } = await supabase
      .from('inv_ubicaciones')
      .select('id, nombre')
      .eq('id', id)
      .maybeSingle();
    if (!ubi?.id) {
      await answerCallbackQuery(params.callbackId, 'Almacén no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, String(ubi.nombre).slice(0, 40));
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'producto',
      origen_id: String(ubi.id),
      origen_nombre: String(ubi.nombre ?? 'Almacén'),
    });
    await enviarPickerProducto(supabase, params.chatId, String(ubi.id), 0);
    return true;
  }

  if (raw.startsWith('matp:')) {
    const m = meta(estado);
    if (!m.origen_id) {
      await answerCallbackQuery(params.callbackId, 'Elija el almacén primero', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId);
    await enviarPickerProducto(supabase, params.chatId, m.origen_id, Number(raw.slice(5)) || 0);
    return true;
  }

  if (raw.startsWith('mat:')) {
    const id = raw.slice(4);
    const m = meta(estado);
    if (!m.origen_id) {
      await answerCallbackQuery(params.callbackId, 'Elija el almacén primero', true);
      return true;
    }
    const stock = await listarStockUbicacionEgreso(supabase, m.origen_id);
    const hit = stock.find((s) => s.material_id === id);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Sin stock de ese producto', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, hit.nombre.slice(0, 40));
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'cantidad',
      producto_id: hit.material_id,
      producto_nombre: hit.nombre,
      unidad: hit.unidad,
      stock: hit.cantidad_disponible,
    });
    await sendTelegramMessage(
      params.chatId,
      `✍️ ¿Cuántos <b>${hit.nombre}</b> da de baja?\nHay ${hit.cantidad_disponible} ${hit.unidad}. Escriba el número.`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (raw.startsWith('mo:')) {
    const motivo = raw.slice(3);
    if (!esMotivoMerma(motivo)) {
      await answerCallbackQuery(params.callbackId, 'Motivo no válido', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, ETIQUETA_MOTIVO_MERMA[motivo]);
    const conMotivo = await patchMeta(supabase, params.chatId, estado, {
      paso: 'foto',
      motivo,
    });
    await pedirFoto(params.chatId);
    void conMotivo;
    return true;
  }

  if (raw === 'foto:camera') {
    await answerCallbackQuery(
      params.callbackId,
      'Toque el clip 📎 → Cámara o Galería y envíe la foto aquí.',
      true,
    );
    return true;
  }

  if (raw === 'foto:skip' || raw === 'foto:done') {
    await answerCallbackQuery(params.callbackId);
    const actual = await getTelegramEstado(supabase, params.chatId);
    await patchMeta(supabase, params.chatId, actual, { paso: 'confirmar' });
    await enviarResumen(supabase, params.chatId, await getTelegramEstado(supabase, params.chatId));
    return true;
  }

  if (raw === 'ok') {
    await answerCallbackQuery(params.callbackId, 'Registrando baja…');
    await ejecutarMerma(supabase, params.chatId, await getTelegramEstado(supabase, params.chatId));
    return true;
  }

  await answerCallbackQuery(params.callbackId);
  return true;
}

export async function manejarTextoMermaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoMermaTelegram(estado)) return false;
  if (!(await puedeRegistrarMermaTelegram(supabase, chatId))) {
    await sendTelegramMessage(chatId, MENSAJE_MERMA_SOLO_DEPOSITARIO);
    return true;
  }
  const m = meta(estado);
  if (m.paso !== 'cantidad') return false;
  const cant = Number.parseFloat(texto.trim().replace(',', '.'));
  if (!Number.isFinite(cant) || cant <= 0) {
    await sendTelegramMessage(chatId, '⚠️ Escriba un número mayor a cero. Ej: 2');
    return true;
  }
  const max = Number(m.stock ?? 0);
  if (cant > max + 0.0001) {
    await sendTelegramMessage(
      chatId,
      `⚠️ Solo hay ${max} ${m.unidad ?? ''}. Escriba otra cantidad.`,
    );
    return true;
  }
  await patchMeta(supabase, chatId, estado, { paso: 'motivo', cantidad: cant });
  await enviarPickerMotivo(chatId);
  return true;
}

export async function manejarFotoMermaTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
}): Promise<boolean> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoMermaTelegram(estado)) return false;
  if (!(await puedeRegistrarMermaTelegram(params.supabase, params.chatId))) {
    await sendTelegramMessage(params.chatId, MENSAJE_MERMA_SOLO_DEPOSITARIO);
    return true;
  }
  const storagePath = `telegram-movimientos/bajas/${params.chatId}/${Date.now()}.${params.ext}`;
  const { error } = await params.supabase.storage
    .from(BUCKET_FOTOS)
    .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });
  if (error) {
    await sendTelegramMessage(params.chatId, '❌ No se pudo guardar la foto. Envíela de nuevo o pulse Omitir.');
    return true;
  }
  const { data } = params.supabase.storage.from(BUCKET_FOTOS).getPublicUrl(storagePath);
  const conFoto = await patchMeta(params.supabase, params.chatId, estado, {
    foto_storage_path: storagePath,
    foto_url: data.publicUrl ?? undefined,
    paso: 'confirmar',
  });
  await sendTelegramMessage(params.chatId, '✅ Foto guardada.');
  await enviarResumen(params.supabase, params.chatId, conFoto);
  return true;
}
