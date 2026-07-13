import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  downloadTelegramFile,
  mimeFromTelegramPath,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import {
  loadCatalogoProyectosApp,
  type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import { getGeminiApiKey } from '@/lib/gemini/client';
import {
  extraerDatosRegistroAguaGemini,
  ppmDesdeExtraccionPrueba,
  type ExtraccionRegistroAgua,
} from '@/lib/telegram/extractAguaGemini';
import { parseLitrosEntregados } from '@/lib/telegram/parseLitrosAgua';
import { getTelegramEstado } from '@/lib/telegram/estados';
import {
  medidorCargaFotoCamionAgua,
  medidorCargaFotoPruebaAgua,
} from '@/lib/telegram/aguaProgresoTelegram';
import {
  MSJ_AGUA_PEDIR_LITROS,
  MSJ_AGUA_PICKER_OBRA,
  MSJ_AGUA_RECORDATORIO_PRUEBA,
  mensajeObraSeleccionadaAgua,
  mensajeRegistroAguaCompleto,
} from '@/lib/telegram/mensajesAgua';

const BUCKET_AGUA = 'ci-proyectos-media';
const PAGE_SIZE = 8;

export const ESTADOS_REGISTRO_AGUA = [
  'ESPERANDO_FOTO_TANQUE',
  'ESPERANDO_FOTO_PRUEBA',
  'ESPERANDO_LITROS',
] as const;

export type EstadoRegistroAgua = (typeof ESTADOS_REGISTRO_AGUA)[number];

export type BotEstadoAguaRow = {
  user_id: string;
  chat_id: string;
  proyecto_id: string;
  estado: EstadoRegistroAgua;
  metadata: BotEstadoAguaMetadata;
  updated_at?: string;
};

export type BotEstadoAguaMetadata = {
  foto_tanque_file_id?: string;
  foto_prueba_file_id?: string;
  foto_tanque_url?: string;
  foto_prueba_url?: string;
  placa_vehiculo?: string | null;
  ppm_minerales?: number | null;
  detalle_ppm?: string | null;
  extraccion_ia?: Record<string, unknown>;
};

export type TelegramPhotoSize = {
  file_id: string;
  file_size?: number;
  width?: number;
  height?: number;
};

function tablaBotEstadosFalta(error: { message?: string; code?: string } | null): boolean {
  const msg = error?.message ?? '';
  return error?.code === '42P01' || msg.includes('does not exist') || msg.includes('bot_estados');
}

function mensajeMigracionAgua(): string {
  return (
    '⚠️ Tablas de registro de agua no instaladas. ' +
    'Ejecuta <code>npm run db:apply-lulo-telegram</code> (migraciones 166–170).'
  );
}

/** Mejor resolución: último elemento del arreglo photo de Telegram. */
export function fileIdFotoTelegramMaxResolucion(
  photo: TelegramPhotoSize[],
): string | null {
  if (!photo.length) return null;
  return photo[photo.length - 1].file_id;
}

export function callbackAguaSeleccion(proyectoId: string): string {
  return `agua:sel:${proyectoId}`;
}

export function callbackAguaPagina(page: number): string {
  return `agua:pp:${page}`;
}

export function parseCallbackAgua(
  data: string,
):
  | { type: 'sel'; proyectoId: string }
  | { type: 'page'; page: number }
  | null {
  if (data.startsWith('agua:sel:')) {
    const uuid = data.slice('agua:sel:'.length).trim();
    if (!isValidProyectoUuid(uuid)) return null;
    return { type: 'sel', proyectoId: uuid };
  }
  if (data.startsWith('agua:pp:')) {
    const page = Number(data.slice('agua:pp:'.length));
    if (!Number.isFinite(page) || page < 0) return null;
    return { type: 'page', page: Math.floor(page) };
  }
  return null;
}

async function loadObrasActivasAgua(
  supabase: SupabaseClient,
): Promise<{ proyectos: ProyectoCatalogo[]; error: string | null }> {
  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, obra_estado_legacy')
    .or('obra_estado_legacy.is.null,obra_estado_legacy.eq.activa')
    .limit(500);

  if (error) {
    const fallback = await loadCatalogoProyectosApp(supabase);
    return fallback;
  }

  const proyectos = (data ?? [])
    .map((r) => ({
      id: String((r as { id: unknown }).id),
      nombre: String((r as { nombre?: unknown }).nombre ?? 'Sin nombre').trim() || 'Sin nombre',
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return { proyectos, error: null };
}

function truncarNombre(nombre: string, max = 28): string {
  const t = nombre.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildKeyboardAgua(
  proyectos: ProyectoCatalogo[],
  page: number,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const totalPages = Math.max(1, Math.ceil(proyectos.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = proyectos.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const rows: Array<Array<{ text: string; callback_data: string }>> = slice.map((p) => [
    { text: truncarNombre(p.nombre), callback_data: callbackAguaSeleccion(p.id) },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) {
      nav.push({ text: '◀ Anterior', callback_data: callbackAguaPagina(safePage - 1) });
    }
    nav.push({
      text: `${safePage + 1} / ${totalPages}`,
      callback_data: callbackAguaPagina(safePage),
    });
    if (safePage < totalPages - 1) {
      nav.push({ text: 'Siguiente ▶', callback_data: callbackAguaPagina(safePage + 1) });
    }
    rows.push(nav);
  }

  return { inline_keyboard: rows };
}

export async function enviarPickerObrasAguaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  page = 0,
): Promise<void> {
  const { proyectos, error } = await loadObrasActivasAgua(supabase);
  if (error) {
    await sendTelegramMessage(chatId, `❌ No se pudieron cargar obras: ${error}`, {
      parse_mode: 'HTML',
    });
    return;
  }
  if (proyectos.length === 0) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay obras activas en el sistema. Crea o activa un proyecto en la app.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const keyboard = buildKeyboardAgua(proyectos, page);
  await sendTelegramMessage(chatId, MSJ_AGUA_PICKER_OBRA, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function getBotEstadoAgua(
  supabase: SupabaseClient,
  userId: string,
): Promise<BotEstadoAguaRow | null> {
  const { data, error } = await supabase
    .from('bot_estados')
    .select('user_id, chat_id, proyecto_id, estado, metadata, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (tablaBotEstadosFalta(error)) {
    throw new Error(mensajeMigracionAgua());
  }
  if (error) throw new Error(error.message);
  if (!data) return null;

  const estado = data.estado as EstadoRegistroAgua;
  if (!ESTADOS_REGISTRO_AGUA.includes(estado)) return null;

  return {
    user_id: data.user_id,
    chat_id: data.chat_id,
    proyecto_id: data.proyecto_id,
    estado,
    metadata: (data.metadata as BotEstadoAguaMetadata) ?? {},
    updated_at: data.updated_at ?? undefined,
  };
}

export async function upsertBotEstadoAgua(
  supabase: SupabaseClient,
  row: BotEstadoAguaRow,
): Promise<void> {
  const { error } = await supabase.from('bot_estados').upsert(
    {
      user_id: row.user_id,
      chat_id: row.chat_id,
      proyecto_id: row.proyecto_id,
      estado: row.estado,
      metadata: row.metadata,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (tablaBotEstadosFalta(error)) {
    throw new Error(mensajeMigracionAgua());
  }
  if (error) throw new Error(error.message);
}

export async function eliminarBotEstadoAgua(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('bot_estados').delete().eq('user_id', userId);
  if (tablaBotEstadosFalta(error)) return;
  if (error) throw new Error(error.message);
}

async function subirBufferAguaStorage(
  supabase: SupabaseClient,
  proyectoId: string,
  etiqueta: 'tanque' | 'prueba',
  buffer: Buffer,
  mimeType: string,
  ext: string,
): Promise<string> {
  const storagePath = `telegram/agua/${proyectoId}/${Date.now()}-${etiqueta}.${ext}`;

  const { error: storageError } = await supabase.storage
    .from(BUCKET_AGUA)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (storageError) {
    throw new Error(`Storage: ${storageError.message}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET_AGUA).getPublicUrl(storagePath);
  return urlData.publicUrl;
}

function buildExtraccionIaJson(extraccion: ExtraccionRegistroAgua | null): Record<string, unknown> {
  if (!extraccion) return { ia_disponible: Boolean(getGeminiApiKey()) };
  return {
    ia_disponible: true,
    placa: extraccion.placa,
    medicion: extraccion.medicion,
  };
}

/** Comando /agua: lista de obras activas. */
export async function manejarComandoAguaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await enviarPickerObrasAguaTelegram(supabase, chatId, 0);
}

/** Callback inline: selección de obra o paginación. */
export async function manejarCallbackAguaTelegram(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    userId: string;
    callbackId: string;
    data: string;
  },
): Promise<boolean> {
  const parsed = parseCallbackAgua(params.data);
  if (!parsed) return false;

  if (parsed.type === 'page') {
    await answerCallbackQuery(params.callbackId);
    await enviarPickerObrasAguaTelegram(supabase, params.chatId, parsed.page);
    return true;
  }

  const { proyectos } = await loadObrasActivasAgua(supabase);
  const hit = proyectos.find((p) => p.id === parsed.proyectoId);
  if (!hit) {
    await answerCallbackQuery(params.callbackId, 'Obra no encontrada', true);
    return true;
  }

  await upsertBotEstadoAgua(supabase, {
    user_id: params.userId,
    chat_id: params.chatId,
    proyecto_id: parsed.proyectoId,
    estado: 'ESPERANDO_FOTO_TANQUE',
    metadata: {},
  });

  await answerCallbackQuery(params.callbackId, `Obra: ${hit.nombre}`);
  await sendTelegramMessage(params.chatId, mensajeObraSeleccionadaAgua(hit.nombre), {
    parse_mode: 'HTML',
  });
  return true;
}

export type ResultadoFotoAgua = { handled: boolean; motivo?: string };
export type ResultadoTextoAgua = { handled: boolean; motivo?: string };

async function prepararRegistroTrasFotoPrueba(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  estado: BotEstadoAguaRow;
  fileIdPrueba: string;
}): Promise<void> {
  const fileIdTanque = params.estado.metadata.foto_tanque_file_id?.trim();
  if (!fileIdTanque) {
    await eliminarBotEstadoAgua(params.supabase, params.userId);
    await sendTelegramMessage(
      params.chatId,
      '❌ Sin foto del camión. Reinicia con <code>/agua</code>.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const progreso = await medidorCargaFotoPruebaAgua(params.chatId);

  try {
    await progreso.reportar(55, 'Descargando…');
    const [tanqueDl, pruebaDl] = await Promise.all([
      downloadTelegramFile(fileIdTanque),
      downloadTelegramFile(params.fileIdPrueba),
    ]);
    const mimeTanque = mimeFromTelegramPath(tanqueDl.filePath);
    const mimePrueba = mimeFromTelegramPath(pruebaDl.filePath);
    const extTanque = tanqueDl.filePath.split('.').pop() ?? 'jpg';
    const extPrueba = pruebaDl.filePath.split('.').pop() ?? 'jpg';

    let extraccion: ExtraccionRegistroAgua | null = null;
    if (getGeminiApiKey()) {
      try {
        await progreso.reportar(68, 'IA placa y PPM…');
        extraccion = await extraerDatosRegistroAguaGemini({
          bufferTanque: tanqueDl.buffer,
          mimeTanque,
          bufferPrueba: pruebaDl.buffer,
          mimePrueba,
        });
      } catch (err) {
        console.warn('[telegram /agua extraccion]', err);
      }
    }

    await progreso.reportar(82, 'Subiendo…');
    const [fotoTanqueUrl, fotoPruebaUrl] = await Promise.all([
      subirBufferAguaStorage(
        params.supabase,
        params.estado.proyecto_id,
        'tanque',
        tanqueDl.buffer,
        mimeTanque,
        extTanque,
      ),
      subirBufferAguaStorage(
        params.supabase,
        params.estado.proyecto_id,
        'prueba',
        pruebaDl.buffer,
        mimePrueba,
        extPrueba,
      ),
    ]);
    await progreso.reportar(100, 'Listo');

    const ppm = extraccion ? ppmDesdeExtraccionPrueba(extraccion.medicion) : null;

    await upsertBotEstadoAgua(params.supabase, {
      ...params.estado,
      chat_id: params.chatId,
      estado: 'ESPERANDO_LITROS',
      metadata: {
        foto_tanque_file_id: fileIdTanque,
        foto_prueba_file_id: params.fileIdPrueba,
        foto_tanque_url: fotoTanqueUrl,
        foto_prueba_url: fotoPruebaUrl,
        placa_vehiculo: extraccion?.placa.placa_vehiculo ?? null,
        ppm_minerales: ppm,
        detalle_ppm: extraccion?.medicion.detalle_medicion ?? null,
        extraccion_ia: buildExtraccionIaJson(extraccion),
      },
    });

    await sendTelegramMessage(params.chatId, MSJ_AGUA_PEDIR_LITROS, { parse_mode: 'HTML' });
  } catch (err) {
    const detalle = err instanceof Error ? err.message.slice(0, 200) : 'Error';
    await progreso.error(
      `Error: <code>${detalle.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>\nReenvía la foto de prueba o <code>/agua</code>.`,
    );
  }
}

/** Paso 3: el obrero escribe los litros entregados. */
export async function manejarTextoLitrosAguaTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  texto: string;
}): Promise<ResultadoTextoAgua> {
  const ctxTelegram = await getTelegramEstado(params.supabase, params.chatId);
  if (ctxTelegram.contexto === 'factura') {
    return { handled: false };
  }

  const estado = await getBotEstadoAgua(params.supabase, params.userId);
  if (!estado || estado.estado !== 'ESPERANDO_LITROS') {
    return { handled: false };
  }

  const litros = parseLitrosEntregados(params.texto);
  if (litros == null) {
    await sendTelegramMessage(
      params.chatId,
      '❌ Escribe solo el número de litros (ej. <code>1500</code> o <code>2500</code>).',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'litros_invalido' };
  }

  const meta = estado.metadata;
  const fotoTanqueUrl = meta.foto_tanque_url?.trim();
  const fotoPruebaUrl = meta.foto_prueba_url?.trim();
  if (!fotoTanqueUrl || !fotoPruebaUrl) {
    await eliminarBotEstadoAgua(params.supabase, params.userId);
    await sendTelegramMessage(
      params.chatId,
      '❌ Faltan las fotos. Reinicia con <code>/agua</code>.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'fotos_faltantes' };
  }

  const registradoEn = new Date().toISOString();
  const ppm = meta.ppm_minerales ?? null;

  const { error: insErr } = await params.supabase.from('registro_agua_obrero').insert({
    proyecto_id: estado.proyecto_id,
    foto_tanque_url: fotoTanqueUrl,
    foto_prueba_url: fotoPruebaUrl,
    creado_por: params.userId,
    chat_id: params.chatId,
    registrado_en: registradoEn,
    placa_vehiculo: meta.placa_vehiculo ?? null,
    litros_entregados: litros,
    ppm_minerales: ppm,
    medicion_agua: ppm,
    unidad_medicion: ppm != null ? 'ppm' : null,
    detalle_medicion: meta.detalle_ppm ?? null,
    extraccion_ia: meta.extraccion_ia ?? buildExtraccionIaJson(null),
  });

  if (insErr) {
    if (tablaBotEstadosFalta(insErr)) {
      await sendTelegramMessage(params.chatId, mensajeMigracionAgua(), { parse_mode: 'HTML' });
    } else {
      await sendTelegramMessage(
        params.chatId,
        `❌ No se guardó: <code>${insErr.message.slice(0, 120)}</code>`,
        { parse_mode: 'HTML' },
      );
    }
    return { handled: true, motivo: 'insert_error' };
  }

  await eliminarBotEstadoAgua(params.supabase, params.userId);

  const fecha = registradoEn.slice(0, 16).replace('T', ' ');
  const placa = meta.placa_vehiculo?.trim() || '—';
  const ppmTxt = ppm != null ? `${ppm} ppm` : meta.detalle_ppm?.slice(0, 40) || 'no leído';

  await sendTelegramMessage(
    params.chatId,
    mensajeRegistroAguaCompleto({
      fecha,
      placa,
      litros,
      ppm: ppmTxt,
    }),
    { parse_mode: 'HTML' },
  );

  return { handled: true, motivo: 'registro_completo' };
}

/**
 * Procesa fotos cuando el usuario tiene flujo /agua activo en bot_estados.
 */
export async function manejarFotoRegistroAguaTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  photo: TelegramPhotoSize[];
}): Promise<ResultadoFotoAgua> {
  const fileId = fileIdFotoTelegramMaxResolucion(params.photo);
  if (!fileId) return { handled: false };

  const ctxTelegram = await getTelegramEstado(params.supabase, params.chatId);
  if (ctxTelegram.contexto === 'factura') {
    return { handled: false };
  }

  const estado = await getBotEstadoAgua(params.supabase, params.userId);
  if (!estado) return { handled: false };

  if (estado.estado === 'ESPERANDO_FOTO_TANQUE') {
    await medidorCargaFotoCamionAgua(params.chatId);
    await upsertBotEstadoAgua(params.supabase, {
      ...estado,
      chat_id: params.chatId,
      estado: 'ESPERANDO_FOTO_PRUEBA',
      metadata: { foto_tanque_file_id: fileId },
    });
    await sendTelegramMessage(params.chatId, MSJ_AGUA_RECORDATORIO_PRUEBA, {
      parse_mode: 'HTML',
    });
    return { handled: true, motivo: 'tanque_ok' };
  }

  if (estado.estado === 'ESPERANDO_FOTO_PRUEBA') {
    await prepararRegistroTrasFotoPrueba({
      supabase: params.supabase,
      chatId: params.chatId,
      userId: params.userId,
      estado,
      fileIdPrueba: fileId,
    });
    return { handled: true, motivo: 'prueba_ok_pide_litros' };
  }

  if (estado.estado === 'ESPERANDO_LITROS') {
    await sendTelegramMessage(
      params.chatId,
      'Escribe los <b>litros</b> en un mensaje de texto (ej. <code>1500</code>).',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'esperando_litros_texto' };
  }

  return { handled: false };
}
