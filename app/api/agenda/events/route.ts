import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listSpecialDates, deleteSpecialDate } from '@/lib/agenda/listSpecialDates';
import { ownerFromAppSession, ownerFromTelegramChat, ownerFromUserId } from '@/lib/agenda/owner';
import { createClient } from '@/lib/supabase/server';
import type { CategoriaFechaEspecial } from '@/types/agenda';

function parseOwner(searchParams: URLSearchParams, bodyOwner?: {
  userId?: string;
  sessionId?: string;
  telegramChatId?: string;
}) {
  if (bodyOwner?.userId?.trim()) return ownerFromUserId(bodyOwner.userId);
  if (bodyOwner?.telegramChatId?.trim()) return ownerFromTelegramChat(bodyOwner.telegramChatId);
  if (bodyOwner?.sessionId?.trim()) return ownerFromAppSession(bodyOwner.sessionId);
  if (searchParams.get('userId')) return ownerFromUserId(searchParams.get('userId')!);
  if (searchParams.get('sessionId')) return ownerFromAppSession(searchParams.get('sessionId')!);
  if (searchParams.get('telegramChatId')) {
    return ownerFromTelegramChat(searchParams.get('telegramChatId')!);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const owner =
    (user?.id ? ownerFromUserId(user.id) : null) ??
    parseOwner(searchParams);

  if (!owner) {
    return NextResponse.json(
      { error: 'Se requiere sesión, userId o sessionId.' },
      { status: 401 },
    );
  }

  const categoria = searchParams.get('categoria') as CategoriaFechaEspecial | null;
  const mesRaw = searchParams.get('mes');
  const mes = mesRaw ? Number(mesRaw) : undefined;

  try {
    const data = await listSpecialDates(owner, {
      categoria: categoria ?? undefined,
      mes: Number.isFinite(mes) ? mes : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al listar eventos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Parámetro id requerido' }, { status: 400 });
  }

  let body: { sessionId?: string; userId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // body opcional
  }

  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const owner =
    (user?.id ? ownerFromUserId(user.id) : null) ??
    parseOwner(searchParams, body);

  if (!owner) {
    return NextResponse.json({ error: 'Se requiere sesión o sessionId.' }, { status: 401 });
  }

  try {
    await deleteSpecialDate(owner, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
