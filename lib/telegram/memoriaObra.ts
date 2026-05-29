import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  downloadTelegramFile,
  mimeFromTelegramPath,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { listarPartidasCampoProyecto, type PartidaCampoRow } from '@/lib/campo/avanceDiarioCampo';
import { registrarEvidenciaObra } from '@/lib/telegram/asignarObraArchivo';
import {
  getTelegramEstado,
  setTelegramContexto,
  type TelegramEstado,
} from '@/lib/telegram/estados';

const PREFIX = 'mem:';
const CB_PARTIDA = `${PREFIX}i:`;

export function esCallbackMemoriaObra(data: string): boolean {
  return data.startsWith(PREFIX);
}

function truncar(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function tecladoPartidas(
  partidas: PartidaCampoRow[],
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  partidas.slice(0, 20).forEach((p, index) => {
    const cod = p.codigo_lulo ?? p.codigo;
    rows.push([
      {
        text: truncar(`📸 ${cod} — ${p.descripcion}`, 60),
        callback_data: `${CB_PARTIDA}${index}`,
      },
    ]);
  });
  return { inline_keyboard: rows };
}

async function appendEvidenciaFotoPartida(
  supabase: SupabaseClient,
  partidaId: string,
  publicUrl: string,
): Promise<void> {
  const { data: row, error } = await supabase
    .from('partidas')
    .select('evidencias_fotos')
    .eq('id', partidaId)
    .maybeSingle();

  if (error?.code === '42P01') return;
  if (error) throw error;
  if (!row) return;

  const actual = Array.isArray(row.evidencias_fotos)
    ? (row.evidencias_fotos as string[])
    : [];
  if (actual.includes(publicUrl)) return;

  const { error: updErr } = await supabase
    .from('partidas')
    .update({ evidencias_fotos: [...actual, publicUrl] })
    .eq('id', partidaId);
  if (updErr) throw updErr;
}

/** Tras elegir obra: lista partidas para memoria fotográfica de avance. */
export async function enviarPickerPartidasMemoriaObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  const partidas = await listarPartidasCampoProyecto(supabase, proyectoId, 25);
  if (!partidas.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay partidas en presupuesto para esta obra. Importa Lulo en Control de obra.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  await setTelegramContexto(supabase, chatId, {
    contexto: 'memoria_obra',
    proyecto_id: proyectoId,
    metadata: {
      paso: 'elegir_partida',
      partidas_ids: partidas.map((p) => p.id),
    },
  });

  await sendTelegramMessage(
    chatId,
    '📸 <b>Memoria descriptiva de avance</b>\n\n' +
      'Elige la <b>partida</b> que documentas con la foto:',
    {
      parse_mode: 'HTML',
      reply_markup: tecladoPartidas(partidas),
    },
  );
}

export async function manejarCallbackMemoriaObra(
  supabase: SupabaseClient,
  opts: {
    chatId: string;
    callbackId: string;
    data: string;
  },
): Promise<boolean> {
  if (!opts.data.startsWith(CB_PARTIDA)) return false;

  const idx = Number(opts.data.slice(CB_PARTIDA.length));
  if (!Number.isInteger(idx) || idx < 0) return true;

  const estado = await getTelegramEstado(supabase, opts.chatId);
  const proyectoId = estado.proyecto_id ?? '';
  const ids = Array.isArray(estado.metadata?.partidas_ids)
    ? (estado.metadata.partidas_ids as string[])
    : [];
  const partidaId = ids[idx];

  if (!proyectoId || !partidaId) {
    await answerCallbackQuery(opts.callbackId, 'Vuelve a usar /memoria', true);
    return true;
  }

  await answerCallbackQuery(opts.callbackId);

  const partidas = await listarPartidasCampoProyecto(supabase, proyectoId, 200);
  const partida = partidas.find((p) => p.id === partidaId);
  if (!partida) {
    await sendTelegramMessage(opts.chatId, 'Partida no encontrada.');
    return true;
  }

  await setTelegramContexto(supabase, opts.chatId, {
    contexto: 'memoria_obra_foto',
    proyecto_id: proyectoId,
    metadata: {
      partida_id: partidaId,
      codigo: partida.codigo,
      descripcion: partida.descripcion,
    },
  });

  await sendTelegramMessage(
    opts.chatId,
    `📷 <b>${partida.codigo}</b> — ${partida.descripcion}\n\n` +
      'Envía la <b>foto del avance físico</b> (puedes añadir caption).\n' +
      'Se guardará en la memoria descriptiva del cronograma.\n\n' +
      '<i>Puedes enviar varias fotos; usa /memoria para cambiar de partida.</i>',
    { parse_mode: 'HTML' },
  );

  return true;
}

export async function manejarFotoMemoriaObraTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  estado: TelegramEstado;
  fileId: string;
  caption?: string;
}): Promise<void> {
  const proyectoId = params.estado.proyecto_id;
  const meta = params.estado.metadata ?? {};
  const partidaId = String(meta.partida_id ?? '');

  if (!proyectoId || !partidaId) {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Sesión expirada. Usa /memoria y elige obra y partida de nuevo.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  try {
    const { buffer, filePath } = await downloadTelegramFile(params.fileId);
    const mimeType = mimeFromTelegramPath(filePath);
    const ext = filePath.split('.').pop() ?? 'jpg';
    const codigo = String(meta.codigo ?? 'partida');
    const titulo = params.caption?.trim()
      ? params.caption.trim().slice(0, 120)
      : `Memoria avance ${codigo}`;

    const { publicUrl } = await registrarEvidenciaObra({
      supabase: params.supabase,
      proyectoId,
      buffer,
      mimeType,
      ext,
      tipo: 'photo',
      caption: titulo,
      telegramFileId: params.fileId,
    });

    if (publicUrl) {
      await appendEvidenciaFotoPartida(params.supabase, partidaId, publicUrl);
    }

    const fotosMemoria = Array.isArray(meta.fotos_memoria)
      ? [...(meta.fotos_memoria as string[])]
      : [];
    if (publicUrl) fotosMemoria.push(publicUrl);

    await setTelegramContexto(params.supabase, params.chatId, {
      metadata: {
        ...meta,
        fotos_memoria: fotosMemoria,
        ultima_foto_url: publicUrl,
      },
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ??
      'https://casainteligente.company';
    const linkCronograma = `${appUrl}/proyectos/modulo/${proyectoId}/control-obra/cronograma`;

    await sendTelegramMessage(
      params.chatId,
      `✅ <b>Foto guardada en memoria descriptiva</b>\n\n` +
        `📌 Partida: <code>${codigo}</code>\n` +
        (publicUrl ? `🔗 ${publicUrl}\n` : '') +
        `\n<a href="${linkCronograma}">Ver cronograma en Casa Inteligente</a>\n\n` +
        '<i>Envía otra foto de esta partida o /memoria para documentar otra.</i>',
      { parse_mode: 'HTML' },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 240) : 'Error al guardar foto';
    await sendTelegramMessage(params.chatId, `❌ No se pudo guardar la foto.\n<code>${msg}</code>`, {
      parse_mode: 'HTML',
    });
  }
}
