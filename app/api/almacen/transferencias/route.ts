import { NextResponse } from 'next/server';
import {
  crearTransferenciaInventario,
  type CrearTransferenciaInput,
} from '@/lib/almacen/crearTransferenciaInventario';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CrearTransferenciaInput;
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const result = await crearTransferenciaInventario(supabase, {
      ...body,
      usuario_despacha_id: body.usuario_despacha_id ?? userId,
      usuario_transporta_id: body.usuario_transporta_id ?? userId,
      usuario_recibe_id: body.usuario_recibe_id ?? userId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al crear transferencia';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
