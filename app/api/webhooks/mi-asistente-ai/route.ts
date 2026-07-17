/**
 * Webhook del bot asistente AI de Casa Inteligente (token separado del operativo).
 * POST https://casainteligente.company/api/webhooks/mi-asistente-ai
 */
import {
  getAsistenteWebhookSecret,
  isAsistenteConfigured,
} from '@/lib/mi-asistente-ai/config/env';
import {
  handleAsistenteWebhookGet,
  handleAsistenteWebhookPost,
} from '@/lib/mi-asistente-ai/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  return handleAsistenteWebhookGet();
}

export async function POST(req: Request) {
  if (!isAsistenteConfigured()) {
    return Response.json({ ok: false, error: 'bot_not_configured' }, { status: 200 });
  }

  const secret = getAsistenteWebhookSecret();
  if (secret) {
    const header = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (header !== secret) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  return handleAsistenteWebhookPost(req);
}
