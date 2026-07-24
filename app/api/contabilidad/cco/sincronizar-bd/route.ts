import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST — Sincroniza libro CCO desde BD remota del suegro (FDW suegro_db → registros_gastos).
 * Body: { proyectoId: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: 'Debe iniciar sesión' }, { status: 401 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    let body: { proyectoId?: string };
    try {
      body = (await request.json()) as { proyectoId?: string };
    } catch {
      return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
    }

    const proyectoId = String(body.proyectoId ?? '').trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta proyectoId' }, { status: 400 });
    }

    const { data, error } = await (admin.client as unknown as {
      rpc: (
        fn: string,
        args: { p_proyecto_id: string },
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc('ci_sincronizar_desde_suegro', {
      p_proyecto_id: proyectoId,
    });

    if (error) {
      console.error('Error en RPC ci_sincronizar_desde_suegro:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? { ok: false, error: 'Sin respuesta del RPC' });
  } catch (error) {
    console.error('Error inesperado en sincronización:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 },
    );
  }
}
