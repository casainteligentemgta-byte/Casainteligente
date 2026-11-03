/**
 * Normaliza cédula, RIF y teléfono de Venezuela para comparar duplicados.
 * Ejemplo: «V-12.345.678» → «V12345678».
 */

import { numeroWhatsapp } from '@/lib/clientes/presupuestosCliente';

const LETRA_DOC = /^[VEJGPC]/i;

/** Cédula o RIF: letra (si hay) + solo dígitos. */
export function normalizarDocumentoVe(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim().toUpperCase();
  if (!t) return '';
  const letra = LETRA_DOC.test(t[0] ?? '') ? t[0] : '';
  const digits = t.replace(/\D/g, '');
  if (!digits) return '';
  return `${letra}${digits}`;
}

/**
 * Teléfono comparable: dígitos con código 58 cuando es celular venezolano.
 * Vacío si no hay un número usable.
 */
export function normalizarTelefonoVe(raw: string | null | undefined): string {
  const wa = numeroWhatsapp(raw);
  if (wa) return wa;
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length >= 7 ? d : '';
}

/** Usuario de Telegram sin @ ni espacios. */
export function normalizarTelegramUsername(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '');
}

export function hrefTelegram(
  username: string | null | undefined,
  telefono: string | null | undefined,
): string | null {
  const u = normalizarTelegramUsername(username);
  if (u) return `https://t.me/${encodeURIComponent(u)}`;
  const wa = numeroWhatsapp(telefono);
  if (wa) return `https://t.me/+${wa}`;
  return null;
}
