/**
 * Registra en Telegram la clave de los webhooks (bot operativo y bot de registro).
 *
 *   GET /api/telegram/registrar-webhook            vuelve a registrar cada webhook, en su
 *                                                  misma dirección, ahora con la clave
 *   GET /api/telegram/registrar-webhook?solo=estado   solo consulta, no cambia nada
 *
 * No recibe ni devuelve ningún secreto: la clave se calcula en el servidor a partir del
 * token de cada bot (lib/telegram/claveWebhook.ts). Solo responde en la dirección
 * *.vercel.app de producción, que Vercel protege con inicio de sesión del equipo; en
 * casainteligente.company responde 404.
 */
import { NextResponse } from 'next/server';
import {
  claveWebhookEsperada,
  claveWebhookObligatoria,
  type UsoWebhookTelegram,
} from '@/lib/telegram/claveWebhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type InfoWebhook = {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  allowed_updates?: string[];
};

async function telegram<T>(token: string, metodo: string, cuerpo?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo ?? {}),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(json.description ?? `Telegram ${metodo} falló`);
  return json.result as T;
}

function resumen(info: InfoWebhook) {
  return {
    direccion: info.url || null,
    avisosPendientes: info.pending_update_count ?? 0,
    ultimoError: info.last_error_message ?? null,
    ultimoErrorFecha: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
  };
}

async function procesar(uso: UsoWebhookTelegram, soloEstado: boolean) {
  const token =
    uso === 'bot' ? process.env.TELEGRAM_BOT_TOKEN?.trim() : process.env.TELEGRAM_LOG_BOT_TOKEN?.trim();
  if (!token) return { configurado: false };

  try {
    const antes = await telegram<InfoWebhook>(token, 'getWebhookInfo');
    if (soloEstado) {
      return { configurado: true, exigeClave: claveWebhookObligatoria(uso), ...resumen(antes) };
    }
    if (!antes.url) {
      return { configurado: true, registrado: false, motivo: 'Este bot no tiene webhook registrado.' };
    }
    const clave = claveWebhookEsperada(uso);
    if (!clave) return { configurado: true, registrado: false, motivo: 'No se pudo calcular la clave.' };

    // Misma dirección y mismos tipos de aviso; no se descartan los avisos pendientes.
    await telegram(token, 'setWebhook', {
      url: antes.url,
      secret_token: clave,
      ...(antes.allowed_updates?.length ? { allowed_updates: antes.allowed_updates } : {}),
    });
    const despues = await telegram<InfoWebhook>(token, 'getWebhookInfo');
    return {
      configurado: true,
      registrado: true,
      conClave: true,
      exigeClave: claveWebhookObligatoria(uso),
      ...resumen(despues),
    };
  } catch (e) {
    return { configurado: true, registrado: false, motivo: e instanceof Error ? e.message : 'Error' };
  }
}

export async function GET(req: Request) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  if (process.env.VERCEL_ENV !== 'production' || !host.endsWith('.vercel.app')) {
    return NextResponse.json({ ok: false, error: 'No disponible.' }, { status: 404 });
  }

  const soloEstado = new URL(req.url).searchParams.get('solo') === 'estado';
  const [bot, registro] = await Promise.all([procesar('bot', soloEstado), procesar('registro', soloEstado)]);
  return NextResponse.json({ ok: true, accion: soloEstado ? 'estado' : 'registrar', bot, registro });
}
