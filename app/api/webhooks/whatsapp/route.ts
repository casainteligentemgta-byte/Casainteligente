import { NextResponse } from 'next/server';

/**
 * Placeholder WhatsApp Cloud API.
 * Configure WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID y apunte el webhook de Meta aquí.
 * Misma lógica que Telegram usando tabla ci_facturas_canal_pendientes (canal = whatsapp).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const verify = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && token && verify && token === verify && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({
    ok: false,
    hint: 'Configure Meta WhatsApp Cloud API. Use Telegram mientras tanto (/api/webhooks/telegram).',
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        'WhatsApp webhook no implementado aún. Use Telegram: configure TELEGRAM_BOT_TOKEN y webhook /api/webhooks/telegram',
    },
    { status: 501 },
  );
}
