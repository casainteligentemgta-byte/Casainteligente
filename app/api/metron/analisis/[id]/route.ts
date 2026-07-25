import { NextResponse } from 'next/server';
import { cargarAnalisisMetron } from '@/lib/metron/persistirAnalisis';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/metron/analisis/[id] */
export async function GET(_req: Request, ctx: Ctx) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  try {
    const analisis = await cargarAnalisisMetron(admin.client, id.trim());
    if (!analisis) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ status: 'ok', analisis });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al cargar' },
      { status: 500 },
    );
  }
}

/** PATCH /api/metron/analisis/[id] — actualizar aprobación de cómputos o status */
export async function PATCH(req: Request, ctx: Ctx) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      status?: string;
      computos?: Array<{ id: string; aprobado?: boolean; cantidad?: number; precio_unitario_estimado?: number }>;
    };

    if (body.status === 'revisado' || body.status === 'borrador') {
      const { error } = await admin.client
        .from('ci_metron_analisis')
        .update({ status: body.status, updated_at: new Date().toISOString() } as never)
        .eq('id', id.trim());
      if (error) throw new Error(error.message);
    }

    if (Array.isArray(body.computos)) {
      for (const c of body.computos) {
        if (!c?.id) continue;
        const patch: Record<string, unknown> = {};
        if (typeof c.aprobado === 'boolean') patch.aprobado = c.aprobado;
        if (typeof c.cantidad === 'number' && Number.isFinite(c.cantidad)) {
          patch.cantidad = c.cantidad;
        }
        if (
          typeof c.precio_unitario_estimado === 'number' &&
          Number.isFinite(c.precio_unitario_estimado)
        ) {
          patch.precio_unitario_estimado = c.precio_unitario_estimado;
        }
        if ('cantidad' in patch || 'precio_unitario_estimado' in patch) {
          const { data: curRaw } = await admin.client
            .from('ci_metron_computos')
            .select('cantidad, precio_unitario_estimado')
            .eq('id', c.id)
            .eq('analisis_id', id.trim())
            .maybeSingle();
          const cur = curRaw as {
            cantidad?: number;
            precio_unitario_estimado?: number;
          } | null;
          const qty = Number(patch.cantidad ?? cur?.cantidad ?? 0);
          const pu = Number(patch.precio_unitario_estimado ?? cur?.precio_unitario_estimado ?? 0);
          patch.monto_estimado = Math.round(qty * pu * 100) / 100;
        }
        if (Object.keys(patch).length === 0) continue;
        const { error } = await admin.client
          .from('ci_metron_computos')
          .update(patch as never)
          .eq('id', c.id)
          .eq('analisis_id', id.trim());
        if (error) throw new Error(error.message);
      }
    }

    const analisis = await cargarAnalisisMetron(admin.client, id.trim());
    return NextResponse.json({ status: 'ok', analisis });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al actualizar' },
      { status: 500 },
    );
  }
}
