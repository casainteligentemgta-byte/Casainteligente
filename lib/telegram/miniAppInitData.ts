/**
 * Verifica los datos que Telegram entrega a una Mini App (initData).
 * Telegram firma esos datos con el token del bot: si la firma cuadra, quien abre la página
 * es la persona de ese Telegram ID. No hay usuario ni contraseña.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Un initData más viejo que esto se rechaza (la página se abre de nuevo desde el bot). */
export const VENTANA_INITDATA_SEG = 24 * 60 * 60;

export type InitDataVerificado =
  | { ok: true; telegramId: string; nombre: string }
  | { ok: false; error: string };

export function verificarInitDataTelegram(
  initData: string,
  botToken: string,
  ahoraSeg: number = Math.floor(Date.now() / 1000),
): InitDataVerificado {
  if (!initData || !botToken) return { ok: false, error: 'Sin datos de Telegram' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, error: 'Firma ausente' };
  params.delete('hash');

  const cadena = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secreto = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculado = createHmac('sha256', secreto).update(cadena).digest('hex');

  const a = Buffer.from(calculado, 'utf8');
  const b = Buffer.from(hash, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: 'Firma no válida' };
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || ahoraSeg - authDate > VENTANA_INITDATA_SEG || authDate - ahoraSeg > 60) {
    return { ok: false, error: 'Sesión de Telegram vencida; abra la página otra vez desde el bot' };
  }

  let usuario: { id?: number | string; first_name?: string; last_name?: string };
  try {
    usuario = JSON.parse(params.get('user') ?? 'null');
  } catch {
    return { ok: false, error: 'Usuario ilegible' };
  }
  const telegramId = String(usuario?.id ?? '').trim();
  if (!telegramId) return { ok: false, error: 'Usuario ausente' };

  const nombre = [usuario.first_name, usuario.last_name].filter(Boolean).join(' ').trim();
  return { ok: true, telegramId, nombre: nombre || 'Usuario' };
}
