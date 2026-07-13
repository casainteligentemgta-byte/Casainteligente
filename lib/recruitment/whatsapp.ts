/**
 * Notificación de cierre por tiempo (falta de agilidad operativa) u otra causa.
 * Configura RECRUITMENT_WHATSAPP_WEBHOOK_URL con un endpoint que acepte POST JSON.
 */
export async function notifyRecruitmentWhatsApp(payload: {
  phone?: string;
  sessionId: string;
  reason: string;
}): Promise<void> {
  const url = process.env.RECRUITMENT_WHATSAPP_WEBHOOK_URL;
  if (!url) {
    console.warn('[recruitment] RECRUITMENT_WHATSAPP_WEBHOOK_URL no configurada; no se envía WhatsApp.');
    return;
  }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('[recruitment] WhatsApp webhook error', e);
  }
}
