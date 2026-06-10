import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  actualizarTelegramWhitelist,
  eliminarTelegramWhitelist,
} from '@/lib/telegram/chatWhitelist';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteCtx = { params: { id: string } };

async function supabaseAdmin() {
  return createSupabaseAdminOnlyClient() ?? (await createClient());
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const id = params.id?.trim() ?? '';
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  let body: {
    nombre?: string;
    cargo?: string | null;
    telefono?: string | null;
    email?: string | null;
    activo?: boolean;
    notas?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const supabase = await supabaseAdmin();
  try {
    const fila = await actualizarTelegramWhitelist(supabase, id, body);
    return NextResponse.json({ ok: true, fila });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo actualizar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const id = params.id?.trim() ?? '';
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const supabase = await supabaseAdmin();
  try {
    await eliminarTelegramWhitelist(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo eliminar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
