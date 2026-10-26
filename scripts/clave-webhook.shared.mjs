/**
 * Clave del webhook de Telegram para los scripts (sin dependencias de Next).
 *
 * Debe producir exactamente lo mismo que lib/telegram/claveWebhook.ts:
 * misma etiqueta por bot y mismo HMAC-SHA256 sobre el token. Si hay clave fija
 * (TELEGRAM_WEBHOOK_SECRET o TELEGRAM_LOG_WEBHOOK_SECRET), esa manda.
 * El test lib/telegram/claveWebhook.test.ts comprueba que ambas implementaciones coinciden.
 */
import { createHmac } from 'crypto';

const ETIQUETA = {
  bot: 'casa-inteligente:webhook:bot:v1',
  registro: 'casa-inteligente:webhook:registro:v1',
};

/**
 * @param {string} token  token del bot
 * @param {'bot'|'registro'} uso
 * @param {string} [fija] clave fija definida en el entorno
 */
export function claveWebhook(token, uso, fija) {
  const f = String(fija ?? '').trim();
  if (f) return f;
  return createHmac('sha256', token).update(ETIQUETA[uso]).digest('hex');
}
