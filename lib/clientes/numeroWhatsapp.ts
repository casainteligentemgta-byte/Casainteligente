/**
 * Número para wa.me: solo dígitos, con código de país.
 * Celulares venezolanos (0414… / 414…) quedan en 58XXXXXXXXXX.
 * Un solo helper: úsenlo desde ficha, tarjeta y duplicados.
 */
export function numeroWhatsapp(telefono: string | null | undefined): string | null {
  const d = String(telefono ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  if (d.startsWith('00')) return numeroWhatsapp(d.slice(2));
  if (d.length === 13 && d.startsWith('580')) return `58${d.slice(3)}`;
  if (d.length === 11 && d.startsWith('0')) return `58${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('4')) return `58${d}`;
  return d;
}
