import { answerCallbackQuery } from '@/lib/telegram/botApi';
import { fotoMovimientoObligatoria } from '@/lib/telegram/fotoObligatoria';

export const SUFIJO_CALLBACK_FOTO_CAMARA = 'foto:camera';

export const TEXTO_AYUDA_CAMARA_TELEGRAM =
  'Toca el <b>clip 📎</b> que está junto a donde escribes → <b>Cámara</b> o <b>Galería</b>, envía la foto aquí y luego pulsa <b>Listo con fotos</b>.';

export const ALERTA_CAMARA_TELEGRAM =
  'El bot no puede abrir la cámara. Toca el clip 📎 junto a donde escribes → Cámara o Galería, envía la foto al chat y pulsa Listo con fotos.';

/**
 * Teclado inline: ayuda para enviar la foto + listo. «Omitir» solo aparece si es opcional.
 * Un bot no puede abrir la cámara: el primer botón solo muestra cómo adjuntarla, y por eso
 * su texto es una pregunta y no «Cámara».
 */
export function tecladoSoporteFotosTelegram(prefix: string): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  const acciones = [{ text: '✅ Listo con fotos', callback_data: `${prefix}foto:done` }];
  if (!fotoMovimientoObligatoria()) {
    acciones.push({ text: '⏭ Omitir fotos', callback_data: `${prefix}foto:skip` });
  }
  return {
    inline_keyboard: [
      [{ text: '❓ ¿Cómo envío la foto?', callback_data: `${prefix}${SUFIJO_CALLBACK_FOTO_CAMARA}` }],
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
