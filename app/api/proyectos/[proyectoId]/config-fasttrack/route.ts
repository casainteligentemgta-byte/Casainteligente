import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string } };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: 'ID de proyecto inválido' }, { status: 400 });
  }

  let body: { limite_fast_track_usd?: unknown };
  try {
    body = (await req.json()) as { limite_fast_track_usd?: unknown };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const limite = Number(body.limite_fast_track_usd);
  if (!Number.isFinite(limite) || limite < 0) {
    return NextResponse.json(
      { error: 'Indique un límite Fast-Track válido (número ≥ 0).' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('ci_proyectos')
    .update({
      limite_fast_track_usd: Math.round(limite * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proyectoId)
    .select('id, limite_fast_track_usd')
    .maybeSingle();

  if (error) {
    if (error.code === '42703' || /limite_fast_track_usd/i.test(error.message ?? '')) {
      return NextResponse.json(
        { error: 'Columna limite_fast_track_usd no existe. Aplique migración 198.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    limite_fast_track_usd: Number(data.limite_fast_track_usd),
  });
}
