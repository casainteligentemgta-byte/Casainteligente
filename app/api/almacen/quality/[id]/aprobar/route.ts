import { NextResponse } from 'next/server';
import {
  approveQualityInspection,
  formatApproveError,
} from '@/lib/almacen/approveQualityInspection';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveId(params: { id?: string } | Promise<{ id?: string }>): Promise<string | null> {
  const p = params instanceof Promise ? await params : params;
  const id = p.id?.trim();
  return id && id !== 'undefined' ? id : null;
}

/** Libera material de cuarentena → stock disponible en almacén destino. */
export async function POST(_req: Request, ctx: RouteCtx) {
  try {
    const id = await resolveId(ctx.params);
    if (!id) {
      return NextResponse.json({ error: 'ID de inspección inválido.' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    await approveQualityInspection(admin.client, id, null);

    return NextResponse.json({ success: true, ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: formatApproveError(err) },
      { status: 400 },
    );
  }
}
