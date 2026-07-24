import { NextResponse } from 'next/server';
import { getTelegramBotToken } from '@/lib/telegram/botApi';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = supabaseAdminForRoute();
    const token = getTelegramBotToken();
    let total = 0;
    let supabaseOk = admin.ok;

    if (admin.ok) {
      const { count, error } = await admin.client
        .from('ci_facturas_canal_pendientes')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      total = count ?? 0;
    }

    let webhookUrl: string | null = null;
    let webhookPending = 0;
    let webhookError: string | null = null;

    if (token) {
      try {
        const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
          cache: 'no-store',
        });
        const infoJson = (await infoRes.json()) as {
          ok?: boolean;
          result?: {
            url?: string;
            pending_update_count?: number;
            last_error_message?: string;
          };
        };
        if (infoJson.ok && infoJson.result) {
          webhookUrl = infoJson.result.url ?? null;
          webhookPending = infoJson.result.pending_update_count ?? 0;
          webhookError = infoJson.result.last_error_message ?? null;
        }
      } catch {
        webhookError = 'No se pudo consultar getWebhookInfo';
      }
    }

    const base =
      process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      'https://casainteligente.company';
    const webhookEsperado = `${base.replace(/\/$/, '')}/api/webhooks/telegram`;

    return NextResponse.json(
      {
        totalPendientes: total,
        supabaseOk,
        telegramToken: Boolean(token),
        webhookUrl,
        webhookEsperado,
        webhookOk: Boolean(webhookUrl && webhookUrl.includes('/api/webhooks/telegram')),
        webhookPending,
        webhookError,
        tokenEnServidor: Boolean(token),
        supabaseServiceRole: Boolean(
          process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
            process.env.SUPABASE_SECRET_KEY?.trim() ||
            process.env.SUPABASE_SERVICE_KEY?.trim(),
        ),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al consultar estado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
