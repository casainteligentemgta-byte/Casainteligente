const GRAPH = 'https://graph.facebook.com/v21.0';

export function getWhatsAppToken(): string | null {
  return process.env.WHATSAPP_TOKEN?.trim() || process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
}

export function getWhatsAppPhoneNumberId(): string | null {
  return process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null;
}

export function getWhatsAppAllowedPhones(): Set<string> {
  const raw = process.env.WHATSAPP_ALLOWED_PHONES?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.replace(/\D/g, ''))
      .filter(Boolean),
  );
}

export function isPhoneAllowed(from: string): boolean {
  const allowed = getWhatsAppAllowedPhones();
  if (allowed.size === 0) return true;
  const digits = from.replace(/\D/g, '');
  return allowed.has(digits);
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = getWhatsAppToken();
  const phoneId = getWhatsAppPhoneNumberId();
  if (!token || !phoneId) throw new Error('WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados');

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: body.slice(0, 4090) },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp send: ${err.slice(0, 300)}`);
  }
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const token = getWhatsAppToken();
  if (!token) throw new Error('WHATSAPP_TOKEN no configurado');

  const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error('No se obtuvo metadata del media WhatsApp');
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error('URL de media WhatsApp vacía');

  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!fileRes.ok) throw new Error('No se pudo descargar media WhatsApp');
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { buffer, mimeType: meta.mime_type ?? 'image/jpeg' };
}
