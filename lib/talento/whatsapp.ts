/**
 * Webhook para notificar por WhatsApp (evaluación / expiración de examen).
 * Configura TALENTO_WHATSAPP_WEBHOOK_URL o, en su defecto, RECRUITMENT_WHATSAPP_WEBHOOK_URL.
 */
export async function notifyTalentoWhatsAppExpiracion(payload: {
  empleadoId: string;
  nombre?: string | null;
  telefono?: string | null;
  motivo: string;
}): Promise<void> {
  const url =
    process.env.TALENTO_WHATSAPP_WEBHOOK_URL ?? process.env.RECRUITMENT_WHATSAPP_WEBHOOK_URL;
  if (!url) {
    console.warn(
      '[talento] TALENTO_WHATSAPP_WEBHOOK_URL (o RECRUITMENT_WHATSAPP_WEBHOOK_URL) no configurada; no se envía WhatsApp.',
    );
    return;
  }
  const message = [
    'CASA INTELIGENTE — Examen de talento',
    `Candidato: ${payload.nombre?.trim() || 'Sin nombre'}`,
    `Motivo: ${payload.motivo}`,
    `ID empleado: ${payload.empleadoId}`,
  ].join('\n');
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'talento_examen_expiracion',
        empleado_id: payload.empleadoId,
        phone: payload.telefono ?? undefined,
        message,
        motivo: payload.motivo,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('[talento] WhatsApp webhook error', e);
  }
}
