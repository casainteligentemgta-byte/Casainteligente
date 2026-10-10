/**
 * Clave del webhook de Telegram.
 *
 * Telegram puede enviar en cada aviso una clave que solo conocen él y este servidor
 * (cabecera `x-telegram-bot-api-secret-token`). Con ella, nadie más puede hacerse pasar
 * por Telegram y «pulsar botones» o escribir a nombre de otra persona.
 *
 * La clave no se guarda en ningún lado: se calcula a partir del token del bot, que ya es
 * secreto. Así no hay un valor nuevo que copiar entre Vercel y Telegram. Si alguien define
 * TELEGRAM_WEBHOOK_SECRET (o TELEGRAM_LOG_WEBHOOK_SECRET), ese valor manda.
 *
 * Puesta en marcha sin dejar el bot caído:
 *   1. Publicar este código (acepta avisos con o sin clave).
 *   2. Registrar el webhook con la clave (GET /api/telegram/registrar-webhook).
 *   3. Con Telegram ya enviándola, exigirla: TELEGRAM_WEBHOOK_CLAVE_OBLIGATORIA=1.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { simulacionBotActiva } from '@/lib/telegram/simulacion/contexto';

export const CABECERA_CLAVE_WEBHOOK = 'x-telegram-bot-api-secret-token';

/** `bot`: el bot operativo. `registro`: el bot del chat de registro (espejo). */
export type UsoWebhookTelegram = 'bot' | 'registro';

const ETIQUETA: Record<UsoWebhookTelegram, string> = {
  bot: 'casa-inteligente:webhook:bot:v1',
  registro: 'casa-inteligente:webhook:registro:v1',
};

/** Clave calculada a partir del token: 64 caracteres hexadecimales (Telegram admite A-Z a-z 0-9 _ -). */
export function claveWebhookDerivada(token: string, uso: UsoWebhookTelegram): string {
  return createHmac('sha256', token).update(ETIQUETA[uso]).digest('hex');
}

/** La clave que Telegram debe enviar, o null si ese bot no está configurado. */
export function claveWebhookEsperada(uso: UsoWebhookTelegram): string | null {
  const fija =
    uso === 'bot'
      ? process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
      : process.env.TELEGRAM_LOG_WEBHOOK_SECRET?.trim();
  if (fija) return fija;
  const token =
    uso === 'bot' ? process.env.TELEGRAM_BOT_TOKEN?.trim() : process.env.TELEGRAM_LOG_BOT_TOKEN?.trim();
  return token ? claveWebhookDerivada(token, uso) : null;
}

/** ¿Se rechazan los avisos que llegan sin clave? */
export function claveWebhookObligatoria(uso: UsoWebhookTelegram): boolean {
  const flag = process.env.TELEGRAM_WEBHOOK_CLAVE_OBLIGATORIA?.trim().toLowerCase();
  if (flag === '1' || flag === 'true') return true;
  // Compatibilidad: quien ya tenía una clave fija definida la estaba exigiendo.
  return uso === 'bot'
    ? Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim())
    : Boolean(process.env.TELEGRAM_LOG_WEBHOOK_SECRET?.trim());
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type ResultadoClaveWebhook = 'valida' | 'ausente_permitida' | 'ausente_rechazada' | 'invalida';

/** Decide si un aviso se acepta según la clave que trae. Función pura: recibe todo por parámetro. */
export function evaluarClaveWebhook(params: {
  recibida: string | null | undefined;
  esperada: string | null;
  obligatoria: boolean;
}): ResultadoClaveWebhook {
  const recibida = params.recibida?.trim() || '';
  if (!recibida) return params.obligatoria ? 'ausente_rechazada' : 'ausente_permitida';
  // Una clave equivocada nunca pasa, se exija o no.
  if (!params.esperada || !iguales(recibida, params.esperada)) return 'invalida';
  return 'valida';
}

/** Valida la clave de un aviso entrante. Los ensayos del bot no pasan por Telegram. */
export function validarClaveWebhook(req: Request, uso: UsoWebhookTelegram): ResultadoClaveWebhook {
  if (simulacionBotActiva()) return 'valida';
  return evaluarClaveWebhook({
    recibida: req.headers.get(CABECERA_CLAVE_WEBHOOK),
    esperada: claveWebhookEsperada(uso),
    obligatoria: claveWebhookObligatoria(uso),
  });
}

export function claveWebhookAceptada(r: ResultadoClaveWebhook): boolean {
  return r === 'valida' || r === 'ausente_permitida';
}
