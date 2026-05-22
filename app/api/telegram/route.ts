import {
  handleTelegramWebhookGet,
  handleTelegramWebhookPost,
} from '@/lib/telegram/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function GET() {
  return handleTelegramWebhookGet();
}

export async function POST(req: Request) {
  return handleTelegramWebhookPost(req);
}
