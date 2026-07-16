/**
 * Webhook del bot oficial Casa Inteligente.
 * Incluye conciliación PR-XXXX (ver lib/telegram/procuraConciliacionWebhook.ts vía webhookRoute).
 */
import {
  handleTelegramWebhookGet,
  handleTelegramWebhookRoutePost,
} from '@/lib/telegram/webhookRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function GET() {
  return handleTelegramWebhookGet();
}

export async function POST(req: Request) {
  return handleTelegramWebhookRoutePost(req);
}
