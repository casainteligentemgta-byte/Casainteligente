import { answerCallbackQuery } from '@/lib/telegram/botApi';
import { fotoMovimientoObligatoria } from '@/lib/telegram/fotoObligatoria';

export const SUFIJO_CALLBACK_FOTO_CAMARA = 'foto:camera';

export const TEXTO_AYUDA_CAMARA_TELEGRAM =
  'Toca <b>📎 Adjuntar</b> (abajo en Telegram) → <b>Cámara</b> o <b>Galería</b>, envía la foto aquí y luego pulsa <b>Listo con fotos</b>.';

export const ALERTA_CAMARA_TELEGRAM =
  'Toca 📎 Adjuntar abajo → Cámara o Galería. Envía la foto al chat y pulsa Listo con fotos.';

/** Teclado inline: cámara (ayuda) + listo. «Omitir» solo aparece si la foto es opcional. */
export function tecladoSoporteFotosTelegram(prefix: string): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  const acciones = [{ text: '✅ Listo con fotos', callback_data: `${prefix}foto:done` }];
  if (!fotoMovimientoObligatoria()) {
    acciones.push({ text: '⏭ Omitir fotos', callback_data: `${prefix}foto:skip` });
  }
  return {
    inline_keyboard: [
      [{ text: '📷 Cámara / adjuntar', callback_data: `${prefix}${SUFIJO_CALLBACK_FOTO_CAMARA}` }],
      acciones,
    ],
  };
}

export function esCallbackHintCamaraFoto(data: string, prefix: string): boolean {
  return data === `${prefix}${SUFIJO_CALLBACK_FOTO_CAMARA}`;
}

export async function responderHintCamaraTelegram(callbackId: string): Promise<void> {
  await answerCallbackQuery(callbackId, ALERTA_CAMARA_TELEGRAM, true);
}
