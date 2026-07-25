import { NextResponse } from 'next/server';
import { listarAnalisisMetronPorProyecto } from '@/lib/metron/persistirAnalisis';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/** GET /api/metron/analisis?proyecto_id= */
export async function GET(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const proyectoId = new URL(req.url).searchParams.get('proyecto_id')?.trim() || '';
  if (!proyectoId) {
    return NextResponse.json({ error: 'proyecto_id es requerido' }, { status: 400 });
  }

  try {
    const items = await listarAnalisisMetronPorProyecto(admin.client, proyectoId);
    return NextResponse.json({ status: 'ok', items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al listar' },
      { status: 500 },
    );
  }
}
