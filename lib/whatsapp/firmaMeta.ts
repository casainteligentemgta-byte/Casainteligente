/**
 * Firma de los avisos de WhatsApp (Meta Cloud API).
 *
 * Meta firma cada aviso con el «App Secret» de la aplicación y manda el resultado en la
 * cabecera `X-Hub-Signature-256: sha256=<hex>`. Sin comprobarla, cualquiera que conozca
 * la dirección del webhook puede hacerse pasar por WhatsApp y cargar facturas a nombre
 * de un teléfono autorizado.
 *
 * Sin `WHATSAPP_APP_SECRET` configurado no se acepta ningún aviso.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export function secretoAppWhatsapp(): string | null {
  return process.env.WHATSAPP_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim() || null;
}

/** `cuerpo` debe ser el texto exacto recibido (antes de interpretar el JSON). */
export function firmaMetaValida(
  cuerpo: string,
  cabecera: string | null | undefined,
  secretoApp: string | null | undefined,
): boolean {
  const secreto = (secretoApp ?? '').trim();
  const recibida = (cabecera ?? '').trim();
  if (!secreto || !recibida.startsWith('sha256=')) return false;

  const hex = recibida.slice('sha256='.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) return false;

  const esperada = createHmac('sha256', secreto).update(cuerpo, 'utf8').digest();
  const dada = Buffer.from(hex, 'hex');
  return dada.length === esperada.length && timingSafeEqual(dada, esperada);
}
