import { sendTelegramMessage } from '@/lib/telegram/botApi'
import { responderPreguntaTecnico } from '@/lib/netvision/tecnico'
import {
  MENSAJE_AYUDA_TECNICO_TELEGRAM,
  TECNICO_PREGUNTA_MIN,
  escaparHtmlTelegram,
  partirMensajeTelegram,
} from '@/lib/netvision/tecnicoContexto'

/** /tecnico <pregunta> — responde con el técnico de dispositivos (IA). */
export async function manejarTecnicoTelegram(
  chatId: string | number,
  pregunta: string,
): Promise<void> {
  const q = pregunta.trim()
  if (q.length < TECNICO_PREGUNTA_MIN) {
    await sendTelegramMessage(chatId, MENSAJE_AYUDA_TECNICO_TELEGRAM, { parse_mode: 'HTML' })
    return
  }

  await sendTelegramMessage(chatId, '🛠 Consultando al técnico…')

  const { respuesta, proveedor } = await responderPreguntaTecnico(q)
  const partes = partirMensajeTelegram(respuesta)
  const pie =
    proveedor === 'ninguno'
      ? ''
      : '\n\n<i>— Técnico IA · verifica los datos críticos en la ficha del fabricante</i>'

  for (let i = 0; i < partes.length; i++) {
    const ultimo = i === partes.length - 1
    await sendTelegramMessage(chatId, `${escaparHtmlTelegram(partes[i]!)}${ultimo ? pie : ''}`, {
      parse_mode: 'HTML',
    })
  }
}
