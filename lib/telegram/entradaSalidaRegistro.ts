import type { SupabaseClient } from '@supabase/supabase-js';
import {
  downloadTelegramFile,
  mimeFromTelegramPath,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import {
  mensajeInicioEntradaSalida,
  mensajeObraListaEntradaSalida,
  mensajePedirObservacion,
  mensajeRegistroCompleto,
} from '@/lib/telegram/mensajesEntradaSalida';
import {
  enviarPickerProyectosTelegram,
  nombreProyectoTelegram,
} from '@/lib/telegram/proyectoPicker';
import type { TelegramPhotoSize } from '@/lib/telegram/aguaRegistro';
import { fileIdFotoTelegramMaxResolucion } from '@/lib/telegram/aguaRegistro';

const BUCKET = 'ci-proyectos-media';
const MIN_OBS = 3;

export type TipoMovimientoObra = 'entrada' | 'salida';

export type PasoEntradaSalida = 'foto' | 'observacion';

export type MetadataEntradaSalida = {
  paso?: PasoEntradaSalida;
  tipo_movimiento?: TipoMovimientoObra;
  foto_storage_path?: string;
  foto_url?: string;
  telegram_user_id?: string;
  telegram_username?: string | null;
};

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

function meta(estado: TelegramEstado): MetadataEntradaSalida {
  return (estado.metadata ?? {}) as MetadataEntradaSalida;
}

function contextoEsEntradaSalida(ctx: string): ctx is 'entrada_obra' | 'salida_obra' {
  return ctx === 'entrada_obra' || ctx === 'salida_obra';
}

export function tipoDesdeContexto(ctx: string): TipoMovimientoObra | null {
  if (ctx === 'entrada_obra') return 'entrada';
  if (ctx === 'salida_obra') return 'salida';
  return null;
}

function tablaMovimientosFalta(error: { message?: string; code?: string } | null): boolean {
  const msg = error?.message ?? '';
  return error?.code === '42P01' || msg.includes('does not exist');
}

function mensajeMigracion(): string {
  return (
    '⚠️ Tabla de entradas/salidas no instalada. ' +
    'Ejecuta <code>npm run db:apply-lulo-telegram</code> (migración 174).'
  );
}

export async function manejarComandoEntradaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'entrada_obra',
    proyecto_id: null,
    metadata: { paso: 'foto', tipo_movimiento: 'entrada' },
  });
  await sendTelegramMessage(chatId, mensajeInicioEntradaSalida('entrada'), {
    parse_mode: 'HTML',
  });
  await enviarPickerProyectosTelegram(supabase, chatId, 'entrada_obra');
}

export async function manejarComandoSalidaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    proyecto_id: null,
    metadata: { paso: 'foto', tipo_movimiento: 'salida' },
  });
  await sendTelegramMessage(chatId, mensajeInicioEntradaSalida('salida'), {
    parse_mode: 'HTML',
  });
  await enviarPickerProyectosTelegram(supabase, chatId, 'salida_obra');
}

/** Tras elegir obra en el picker (entrada/salida). */
export async function prepararEntradaSalidaTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  tipo: TipoMovimientoObra,
): Promise<void> {
  const ctx = tipo === 'entrada' ? 'entrada_obra' : 'salida_obra';
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await setTelegramContexto(supabase, chatId, {
    contexto: ctx,
    proyecto_id: proyectoId,
    metadata: { paso: 'foto', tipo_movimiento: tipo },
  });
  await sendTelegramMessage(chatId, mensajeObraListaEntradaSalida(tipo, nombre), {
    parse_mode: 'HTML',
  });
}

async function subirFotoMovimiento(
  supabase: SupabaseClient,
  proyectoId: string,
  tipo: TipoMovimientoObra,
  buffer: Buffer,
  mimeType: string,
  ext: string,
): Promise<{ storagePath: string; publicUrl: string | null }> {
  const storagePath = `telegram-movimientos/${proyectoId}/${tipo}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl ?? null };
}

async function guardarMovimiento(params: {
  supabase: SupabaseClient;
  proyectoId: string;
  tipo: TipoMovimientoObra;
  storagePath: string;
  publicUrl: string | null;
  observacion: string;
  chatId: string;
  userId: string;
  username?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await params.supabase.from('ci_obra_movimientos_material').insert({
    proyecto_id: params.proyectoId,
    tipo: params.tipo,
    foto_storage_path: params.storagePath,
    foto_url: params.publicUrl,
    observacion: params.observacion.trim(),
    chat_id: params.chatId,
    telegram_user_id: params.userId,
    telegram_username: params.username ?? null,
  });
  if (error) {
    if (tablaMovimientosFalta(error)) return { ok: false, error: 'migration' };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function finalizarMovimiento(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  observacion: string,
): Promise<void> {
  const tipo = meta(estado).tipo_movimiento ?? tipoDesdeContexto(estado.contexto);
  const proyectoId = estado.proyecto_id;
  const storagePath = meta(estado).foto_storage_path;
  const publicUrl = meta(estado).foto_url ?? null;
  const userId = meta(estado).telegram_user_id ?? chatId;
  const username = meta(estado).telegram_username ?? null;

  if (!tipo || !proyectoId || !storagePath) {
    await sendTelegramMessage(
      chatId,
      '❌ Registro incompleto. Reinicia con <code>/entrada</code> o <code>/salida</code>.',
      { parse_mode: 'HTML' },
    );
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    return;
  }

  const obs = observacion.trim();
  if (obs.length < MIN_OBS) {
    await sendTelegramMessage(
      chatId,
      `✏️ La observación es muy corta (mín. ${MIN_OBS} caracteres). Describe lo visto en la foto.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const guardado = await guardarMovimiento({
    supabase,
    proyectoId,
    tipo,
    storagePath,
    publicUrl,
    observacion: obs,
    chatId,
    userId,
    username,
  });

  if (!guardado.ok) {
    await sendTelegramMessage(
      chatId,
      guardado.error === 'migration' ? mensajeMigracion() : `❌ ${guardado.error}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  const link = `${baseUrlApp()}/proyectos/modulo/${proyectoId}/control-obra`;

  await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
  await sendTelegramMessage(
    chatId,
    mensajeRegistroCompleto({ tipo, nombreObra: nombre, observacion: obs, linkObra: link }),
    { parse_mode: 'HTML' },
  );
}

export type ResultadoEntradaSalida = { handled: boolean; motivo?: string };

export async function manejarFotoEntradaSalidaTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  username?: string | null;
  photo: TelegramPhotoSize[];
  caption?: string;
}): Promise<ResultadoEntradaSalida> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!contextoEsEntradaSalida(estado.contexto)) {
    return { handled: false };
  }

  const tipo = meta(estado).tipo_movimiento ?? tipoDesdeContexto(estado.contexto);
  if (!tipo) return { handled: false };

  const paso = meta(estado).paso ?? 'foto';
  if (paso !== 'foto') {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Ya recibí la foto. Envía solo el texto de la <b>observación</b>.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'paso_observacion' };
  }

  if (!estado.proyecto_id) {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Primero elige la obra con el comando (<code>/entrada</code> o <code>/salida</code>).',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'sin_obra' };
  }

  const fileId = fileIdFotoTelegramMaxResolucion(params.photo);
  if (!fileId) return { handled: true, motivo: 'sin_file_id' };

  try {
    const { buffer, filePath } = await downloadTelegramFile(fileId);
    const mimeType = mimeFromTelegramPath(filePath);
    const ext = filePath.split('.').pop() ?? 'jpg';
    const { storagePath, publicUrl } = await subirFotoMovimiento(
      params.supabase,
      estado.proyecto_id,
      tipo,
      buffer,
      mimeType,
      ext,
    );

    const metadataActualizado: MetadataEntradaSalida = {
      ...meta(estado),
      paso: 'observacion',
      foto_storage_path: storagePath,
      foto_url: publicUrl ?? undefined,
      telegram_user_id: params.userId,
      telegram_username: params.username ?? null,
    };

    const caption = params.caption?.trim();
    if (caption && caption.length >= MIN_OBS) {
      await finalizarMovimiento(
        params.supabase,
        params.chatId,
        { ...estado, metadata: metadataActualizado },
        caption,
      );
      return { handled: true, motivo: 'foto_y_caption' };
    }

    await setTelegramContexto(params.supabase, params.chatId, {
      metadata: metadataActualizado,
    });
    await sendTelegramMessage(params.chatId, mensajePedirObservacion(tipo), {
      parse_mode: 'HTML',
    });
    return { handled: true, motivo: 'foto_ok' };
  } catch (err) {
    console.error('[telegram entrada/salida foto]', err);
    await sendTelegramMessage(
      params.chatId,
      '❌ No se pudo guardar la foto. Intenta de nuevo.',
      { parse_mode: 'HTML' },
    );
    return { handled: true, motivo: 'error_foto' };
  }
}

export async function manejarTextoObservacionEntradaSalida(params: {
  supabase: SupabaseClient;
  chatId: string;
  texto: string;
}): Promise<ResultadoEntradaSalida> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!contextoEsEntradaSalida(estado.contexto)) {
    return { handled: false };
  }

  const paso = meta(estado).paso;
  if (paso !== 'observacion' || !meta(estado).foto_storage_path) {
    if (paso === 'foto' && estado.proyecto_id) {
      await sendTelegramMessage(
        params.chatId,
        '📷 Envía primero la <b>foto</b> del material. Luego escribe la observación.',
        { parse_mode: 'HTML' },
      );
      return { handled: true, motivo: 'esperando_foto' };
    }
    return { handled: false };
  }

  await finalizarMovimiento(params.supabase, params.chatId, estado, params.texto);
  return { handled: true, motivo: 'observacion_ok' };
}

export function esComandoEntrada(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return t === '/entrada';
}

export function esComandoSalida(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return t === '/salida';
}
