import { createClient } from '@supabase/supabase-js';
import { processWhatsappInvoiceMedia } from '@/lib/whatsapp/processInvoiceFromWhatsapp';
import {
  getWhatsAppToken,
  isPhoneAllowed,
  sendWhatsAppText,
} from '@/lib/whatsapp/botApi';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/resolveServiceRoleKey';
import { firmaMetaValida, secretoAppWhatsapp } from '@/lib/whatsapp/firmaMeta';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = resolveSupabaseServiceRoleKey() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Supabase no configurado');
  return createClient(url, key);
}

type WaMessage = {
  from: string;
  id: string;
  type: string;
  image?: { id: string; mime_type?: string };
  document?: { id: string; mime_type?: string; filename?: string };
};

/** Verificación Meta WhatsApp Cloud API */
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
    ok: Boolean(getWhatsAppToken()),
    hint: 'Meta webhook: hub.mode=subscribe + hub.verify_token=WHATSAPP_VERIFY_TOKEN',
  });
}

export async function POST(req: Request) {
  try {
    if (!getWhatsAppToken()) {
      return NextResponse.json({ error: 'WHATSAPP_TOKEN no configurado' }, { status: 503 });
    }

    // Solo se atienden avisos firmados por Meta con el secreto de la app.
    const crudo = await req.text();
    if (!firmaMetaValida(crudo, req.headers.get('x-hub-signature-256'), secretoAppWhatsapp())) {
      console.warn('[POST /api/webhooks/whatsapp] aviso sin firma válida; rechazado');
      return NextResponse.json({ error: 'Firma no válida' }, { status: 401 });
    }

    let body: {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: WaMessage[];
            contacts?: Array<{ profile?: { name?: string } }>;
          };
        }>;
      }>;
    };
    try {
      body = JSON.parse(crudo) as typeof body;
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const messages: WaMessage[] = [];
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          messages.push(msg);
        }
      }
    }

    if (messages.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no_messages' });
    }

    const supabase = supabaseAdmin();

    for (const msg of messages) {
      const from = msg.from;
      if (!isPhoneAllowed(from)) {
        await sendWhatsAppText(
          from,
          '⛔ Este número no está autorizado para enviar facturas. Contacte al administrador.',
        );
        continue;
      }

      let mediaId: string | null = null;
      let mimeHint: string | undefined;
      if (msg.type === 'image' && msg.image?.id) {
        mediaId = msg.image.id;
        mimeHint = msg.image.mime_type;
      } else if (
        msg.type === 'document' &&
        msg.document?.id &&
        (msg.document.mime_type?.startsWith('image/') ||
          msg.document.mime_type === 'application/pdf')
      ) {
        mediaId = msg.document.id;
        mimeHint = msg.document.mime_type;
      }

      if (!mediaId) {
        await sendWhatsAppText(
          from,
          '📷 Envíe una foto o PDF de la factura de compra. Se analizará con IA y quedará pendiente de confirmación en la web.',
        );
        continue;
      }

      const { data: pending, error: insErr } = await supabase
        .from('ci_facturas_canal_pendientes')
        .insert({
          canal: 'whatsapp',
          chat_id: from,
          chat_label: from,
          estado: 'pendiente',
        })
        .select('id')
        .single();

      if (insErr || !pending) {
        await sendWhatsAppText(from, '❌ Error interno al registrar la factura.');
        continue;
      }

      await sendWhatsAppText(from, '⏳ Procesando factura con IA…');

      await processWhatsappInvoiceMedia({
        pendingId: pending.id,
        from,
        mediaId,
        mimeTypeHint: mimeHint,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('[POST /api/webhooks/whatsapp]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error webhook WhatsApp' },
      { status: 500 },
    );
  }
}
