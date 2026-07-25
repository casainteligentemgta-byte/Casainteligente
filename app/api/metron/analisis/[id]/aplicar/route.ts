import { NextResponse } from 'next/server';
import { aplicarAnalisisMetronAPresupuesto } from '@/lib/metron/aplicarPresupuesto';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/metron/analisis/[id]/aplicar
 * Body opcional: { reemplazar_metron?: boolean }
 */
export async function POST(req: Request, ctx: Ctx) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { reemplazar_metron?: boolean };
    const out = await aplicarAnalisisMetronAPresupuesto(admin.client, id.trim(), {
      reemplazarMetron: Boolean(body.reemplazar_metron),
      soloAprobados: true,
    });

    return NextResponse.json({
      status: 'ok',
      insertadas: out.insertadas,
      analisis: out.analisis,
      mensaje: `Se insertaron ${out.insertadas} partidas (origen metron) en el presupuesto de obra.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'No se pudo aplicar al presupuesto',
      },
      { status: 400 },
    );
  }
}
