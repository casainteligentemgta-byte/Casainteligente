import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import {
  answerCallbackQuery,
  downloadTelegramFile,
  editTelegramMessage,
  mimeFromTelegramPath,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { setTelegramContexto } from '@/lib/telegram/estados';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';

const PROYECTO_MEDIA_BUCKET = 'ci-proyectos-media';
const PREFIJO_CALLBACK = 'asignar_obra';
const OBRAS_ACTIVAS_LIMIT = 5;

/** Telegram limita callback_data a 64 bytes; el file_id va en metadata con token corto. */
export type TipoArchivoTelegram = 'photo' | 'video' | 'document';

export type PendingAsignacionArchivo = {
  file_id: string;
  tipo: TipoArchivoTelegram;
  caption: string | null;
  token: string;
  destino: 'obra' | 'gasto_obra';
};

export type ObraActivaTelegram = {
  id: string;
  nombre: string;
};

function truncarNombre(nombre: string, max = 28): string {
  const t = nombre.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function generarTokenAsignacion(): string {
  return randomBytes(4).toString('hex');
}

function baseUrlSupabase(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '') ?? '';
}

function publicUrlStorage(bucket: string, path: string): string | null {
  const base = baseUrlSupabase();
  if (!base) return null;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export function buildCallbackAsignarObra(proyectoId: string, token: string): string {
  return `${PREFIJO_CALLBACK}|${proyectoId}|${token}`;
}

export function parseCallbackAsignarObra(
  data: string,
): { proyectoId: string; token: string } | null {
  if (!data.startsWith(`${PREFIJO_CALLBACK}|`)) return null;
  const parts = data.split('|');
  if (parts.length < 3) return null;
  const proyectoId = parts[1] ?? '';
  const token = parts[2] ?? '';
  if (!isValidProyectoUuid(proyectoId) || !token) return null;
  return { proyectoId, token };
}

/** Últimas obras activas desde ci_proyectos (equivalente operativo a «proyectos» en la app). */
export async function loadUltimasObrasActivas(
  supabase: SupabaseClient,
  limit = OBRAS_ACTIVAS_LIMIT,
): Promise<{ obras: ObraActivaTelegram[]; error: string | null }> {
  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id, nombre')
    .in('estado', ['nuevo', 'levantamiento', 'presupuestado', 'ejecucion', 'entregado'])
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { obras: [], error: error.message };
  }

  const obras = (data ?? []).map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre ?? 'Sin nombre').trim() || 'Sin nombre',
  }));

  return { obras, error: null };
}

function tipoArchivoEtiqueta(tipo: TipoArchivoTelegram): string {
  switch (tipo) {
    case 'photo':
      return 'foto';
    case 'video':
      return 'video';
    case 'document':
      return 'documento';
  }
}

function buildKeyboardAsignarObra(
  obras: ObraActivaTelegram[],
  token: string,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  return {
    inline_keyboard: obras.map((obra) => [
      {
        text: truncarNombre(obra.nombre),
        callback_data: buildCallbackAsignarObra(obra.id, token),
      },
    ]),
  };
}

/** Paso 1: archivo recibido → teclado inline con obras activas. */
export async function enviarPickerAsignarObraTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  fileId: string;
  tipo: TipoArchivoTelegram;
  caption?: string;
  destino?: 'obra' | 'gasto_obra';
}): Promise<void> {
  const { obras, error } = await loadUltimasObrasActivas(params.supabase);
  if (error) {
    await sendTelegramMessage(
      params.chatId,
      `❌ No se pudieron cargar obras: ${error}`,
      { parse_mode: 'HTML' },
    );
    return;
  }
  if (obras.length === 0) {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ No hay obras activas. Crea un proyecto en la app web primero.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const token = generarTokenAsignacion();
  const pending: PendingAsignacionArchivo = {
    file_id: params.fileId,
    tipo: params.tipo,
    caption: params.caption?.trim() ?? null,
    token,
    destino: params.destino ?? 'obra',
  };

  await setTelegramContexto(params.supabase, params.chatId, {
    metadata: { pending_asignacion: pending },
  });

  const keyboard = buildKeyboardAsignarObra(obras, token);
  await sendTelegramMessage(
    params.chatId,
    `📎 <b>¿A qué obra pertenece este ${tipoArchivoEtiqueta(params.tipo)}?</b>\n` +
      `<i>Selecciona una obra abajo (${obras.length} activas recientes)</i>`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}

function resolverPendingAsignacion(
  metadata: Record<string, unknown>,
  token: string,
): PendingAsignacionArchivo | null {
  const raw = metadata.pending_asignacion;
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as PendingAsignacionArchivo;
  if (p.token !== token || !p.file_id) return null;
  return p;
}

export async function registrarEvidenciaObra(params: {
  supabase: SupabaseClient;
  proyectoId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
  tipo: TipoArchivoTelegram;
  caption: string | null;
  telegramFileId: string;
}): Promise<{ storagePath: string; publicUrl: string | null }> {
  const storagePath = `telegram/${params.proyectoId}/${Date.now()}.${params.ext}`;

  const { error: storageError } = await params.supabase.storage
    .from(PROYECTO_MEDIA_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: params.mimeType,
      upsert: true,
    });
  if (storageError) throw storageError;

  const publicUrl = publicUrlStorage(PROYECTO_MEDIA_BUCKET, storagePath);
  const tipoArchivo =
    params.tipo === 'photo'
      ? 'foto_proyecto'
      : params.tipo === 'video'
        ? 'documento'
        : 'documento';

  const { error: insErr } = await params.supabase.from('ci_proyecto_archivos').insert({
    proyecto_id: params.proyectoId,
    tipo: tipoArchivo,
    titulo: params.caption?.slice(0, 120) ?? `Evidencia Telegram (${params.tipo})`,
    descripcion: params.caption,
    storage_bucket: PROYECTO_MEDIA_BUCKET,
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: params.mimeType,
  });
  if (insErr) throw insErr;

  return { storagePath, publicUrl };
}

/** Paso 2: callback asignar_obra → descarga, sube a Storage y vincula al proyecto. */
export async function manejarCallbackAsignarObraTelegram(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    callbackId: string;
    data: string;
    messageId?: number;
  },
): Promise<boolean> {
  const parsed = parseCallbackAsignarObra(params.data);
  if (!parsed) return false;

  const estado = await supabase
    .from('ci_telegram_estados')
    .select('metadata')
    .eq('chat_id', params.chatId)
    .maybeSingle();

  const metadata = (estado.data?.metadata as Record<string, unknown>) ?? {};
  const pending = resolverPendingAsignacion(metadata, parsed.token);

  if (!pending) {
    await answerCallbackQuery(
      params.callbackId,
      'Archivo expirado. Envía el archivo de nuevo.',
      true,
    );
    return true;
  }

  const { data: proyecto } = await supabase
    .from('ci_proyectos')
    .select('id, nombre')
    .eq('id', parsed.proyectoId)
    .maybeSingle();

  if (!proyecto) {
    await answerCallbackQuery(params.callbackId, 'Obra no encontrada', true);
    return true;
  }

  await answerCallbackQuery(params.callbackId, `Asignando a ${proyecto.nombre}…`);

  try {
    const { buffer, filePath } = await downloadTelegramFile(pending.file_id);
    const mimeType = mimeFromTelegramPath(filePath);
    const ext = filePath.split('.').pop() ?? (pending.tipo === 'video' ? 'mp4' : 'jpg');

    const { publicUrl } = await registrarEvidenciaObra({
      supabase,
      proyectoId: parsed.proyectoId,
      buffer,
      mimeType,
      ext,
      tipo: pending.tipo,
      caption: pending.caption,
      telegramFileId: pending.file_id,
    });

    await setTelegramContexto(supabase, params.chatId, {
      contexto: pending.destino === 'gasto_obra' ? 'gasto_obra' : 'obra',
      proyecto_id: parsed.proyectoId,
      metadata: {
        pending_asignacion: null,
        ultima_evidencia_url: publicUrl,
        ultima_evidencia_path: `telegram/${parsed.proyectoId}`,
      },
    });

    const confirmacion =
      `✅ <b>¡Éxito!</b> Archivo asignado a la obra <b>${proyecto.nombre}</b> correctamente.` +
      (publicUrl ? `\n🔗 ${publicUrl}` : '');

    if (params.messageId != null) {
      await editTelegramMessage(params.chatId, params.messageId, confirmacion, {
        parse_mode: 'HTML',
      });
    } else {
      await sendTelegramMessage(params.chatId, confirmacion, { parse_mode: 'HTML' });
    }
  } catch (err) {
    const detalle = err instanceof Error ? err.message.slice(0, 200) : 'Error desconocido';
    await answerCallbackQuery(params.callbackId, `Error: ${detalle}`, true);
    if (params.messageId != null) {
      await editTelegramMessage(
        params.chatId,
        params.messageId,
        `❌ No se pudo asignar el archivo.\n<code>${detalle}</code>`,
        { parse_mode: 'HTML' },
      );
    }
  }

  return true;
}
