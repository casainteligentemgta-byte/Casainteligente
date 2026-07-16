import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  crearTelegramWhitelist,
  listarTelegramWhitelist,
  telegramWhitelistEstaActiva,
  type CrearTelegramWhitelistInput,
} from '@/lib/telegram/chatWhitelist';
import { getTelegramAllowedChatIds } from '@/lib/telegram/botApi';

export const dynamic = 'force-dynamic';

async function supabaseAdmin() {
  return createSupabaseAdminOnlyClient() ?? (await createClient());
}

export async function GET() {
  const supabase = await supabaseAdmin();
  try {
    const [filas, activa] = await Promise.all([
      listarTelegramWhitelist(supabase),
      telegramWhitelistEstaActiva(),
    ]);
    return NextResponse.json({
      filas,
      activa,
      envCount: getTelegramAllowedChatIds().size,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo cargar la lista';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: CrearTelegramWhitelistInput;
  try {
    body = (await req.json()) as CrearTelegramWhitelistInput;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const supabase = await supabaseAdmin();
  try {
    const fila = await crearTelegramWhitelist(supabase, body);
    return NextResponse.json({ ok: true, fila }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo agregar';
    const status = msg.includes('requerido') || msg.includes('inválido') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
