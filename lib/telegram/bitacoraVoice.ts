import type { SupabaseClient } from '@supabase/supabase-js';
import { geminiGenerateWithDocument, getGeminiApiKey } from '@/lib/gemini/client';
import {
  downloadTelegramFile,
  mimeFromTelegramPath,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import { setTelegramContexto, type TelegramEstado } from '@/lib/telegram/estados';

const BITACORA_MODEL = 'gemini-2.5-flash';

const PROMPT_BITACORA = `Actúas como un ingeniero inspector de obras civiles en Venezuela.
Analiza este audio de bitácora de campo, transcribe su contenido y estructúralo en un JSON con las siguientes llaves:
- transcripcion (string): texto completo y fiel del audio en español
- avances (arreglo de strings): cada avance o actividad reportada
- novedades_o_retrasos (arreglo de strings): problemas, retrasos, faltantes o riesgos
- estimado_obreros_activos (número entero): cantidad estimada de obreros activos en frente

Si no se menciona un dato, usa arreglo vacío o 0 según corresponda. Responde SOLO el JSON, sin markdown.`;

export type BitacoraObraDatos = {
  avances: string[];
  novedades_o_retrasos: string[];
  estimado_obreros_activos: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
    .filter(Boolean);
}

function parseBitacoraGemini(raw: string): {
  transcripcion: string;
  datos: BitacoraObraDatos;
} | null {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const transcripcion = String(parsed.transcripcion ?? '').trim();
    const datos: BitacoraObraDatos = {
      avances: asStringArray(parsed.avances),
      novedades_o_retrasos: asStringArray(parsed.novedades_o_retrasos),
      estimado_obreros_activos: Math.max(
        0,
        Math.round(Number(parsed.estimado_obreros_activos) || 0),
      ),
    };
    if (!transcripcion && !datos.avances.length && !datos.novedades_o_retrasos.length) {
      return null;
    }
    return {
      transcripcion: transcripcion || '(Sin transcripción explícita en la respuesta)',
      datos,
    };
  } catch {
    return null;
  }
}

function formatearResumenBitacora(
  transcripcion: string,
  datos: BitacoraObraDatos,
): string {
  const lineas: string[] = [];
  lineas.push('📋 <b>Bitácora registrada</b>');
  lineas.push('');

  if (datos.avances.length) {
    lineas.push('✅ <b>Avances</b>');
    for (const a of datos.avances) {
      lineas.push(`   • ${escapeHtml(a)}`);
    }
    lineas.push('');
  }

  if (datos.novedades_o_retrasos.length) {
    lineas.push('⚠️ <b>Novedades / retrasos</b>');
    for (const n of datos.novedades_o_retrasos) {
      lineas.push(`   • ${escapeHtml(n)}`);
    }
    lineas.push('');
  }

  lineas.push(
    `👷 <b>Obreros activos (estimado):</b> ${datos.estimado_obreros_activos}`,
  );
  lineas.push('');
  const preview =
    transcripcion.length > 400 ? `${transcripcion.slice(0, 400)}…` : transcripcion;
  lineas.push(`📝 <b>Transcripción</b>\n<i>${escapeHtml(preview)}</i>`);
  lineas.push('');
  lineas.push('Puedes enviar otra nota con /bitacora o volver con /obra / /menu.');

  return lineas.join('\n');
}

export async function manejarVozBitacoraTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  estado: TelegramEstado;
  fileId: string;
  durationSec?: number;
}): Promise<void> {
  const proyectoId = params.estado.proyecto_id;
  if (!proyectoId) {
    await sendTelegramMessage(
      params.chatId,
      '⚠️ Vincula un proyecto con <code>/obra &lt;uuid&gt;</code> antes de <code>/bitacora</code>.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (!getGeminiApiKey()) {
    await sendTelegramMessage(
      params.chatId,
      '❌ GEMINI_API_KEY no configurada. No puedo transcribir la bitácora.',
    );
    return;
  }

  await sendTelegramMessage(
    params.chatId,
    '🎙️ Recibí la nota de voz. Descargando y analizando con Gemini…',
  );

  let buffer: Buffer;
  let filePath: string;
  try {
    const downloaded = await downloadTelegramFile(params.fileId);
    buffer = downloaded.buffer;
    filePath = downloaded.filePath;
  } catch (err) {
    console.error('[telegram bitacora download]', err);
    await sendTelegramMessage(
      params.chatId,
      '❌ No pude descargar el audio de Telegram. Intenta reenviar la nota.',
    );
    return;
  }

  const mimeType = mimeFromTelegramPath(filePath);
  const base64 = buffer.toString('base64');

  let rawGemini: string;
  try {
    rawGemini = await geminiGenerateWithDocument({
      model: BITACORA_MODEL,
      prompt: PROMPT_BITACORA,
      mimeType,
      base64,
      temperature: 0.2,
      maxOutputTokens: 4096,
    });
  } catch (err) {
    console.error('[telegram bitacora gemini]', err);
    const msg =
      err instanceof Error ? err.message : 'Error al analizar el audio con Gemini.';
    await sendTelegramMessage(params.chatId, `❌ ${escapeHtml(msg)}`, {
      parse_mode: 'HTML',
    });
    return;
  }

  const parsed = parseBitacoraGemini(rawGemini);
  if (!parsed) {
    await sendTelegramMessage(
      params.chatId,
      '❌ Gemini respondió en un formato no válido. Repite la nota de voz, más clara y corta.',
    );
    return;
  }

  const { error: insErr } = await params.supabase.from('ci_bitacora_obras').insert({
    proyecto_id: proyectoId,
    chat_id: params.chatId,
    transcripcion: parsed.transcripcion,
    datos_json: parsed.datos,
    telegram_file_id: params.fileId,
    duracion_segundos: params.durationSec ?? null,
  });

  if (insErr) {
    console.error('[telegram bitacora insert]', insErr);
    const hint = insErr.message?.includes('does not exist')
      ? ' Ejecuta la migración 162 (ci_bitacora_obras).'
      : '';
    await sendTelegramMessage(
      params.chatId,
      `❌ No se guardó la bitácora: ${escapeHtml(insErr.message)}${hint}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  await setTelegramContexto(params.supabase, params.chatId, {
    contexto: 'obra',
  });

  await sendTelegramMessage(
    params.chatId,
    formatearResumenBitacora(parsed.transcripcion, parsed.datos),
    { parse_mode: 'HTML' },
  );
}
