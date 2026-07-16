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
