import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string } };

/** Historial de avance diario (base para Curva S y reportes). */
export async function GET(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  let q = supabase
    .from('avance_diario_campo')
    .select(
      'id, fecha_reporte, cantidad_ejecutada_hoy, eficiencia_calculada, rentabilidad_diaria, unidad, partida:partidas(codigo, descripcion), perfil:perfiles(nombre)',
    )
    .eq('proyecto_id', proyectoId)
    .order('fecha_reporte', { ascending: false })
    .limit(500);

  if (desde) q = q.gte('fecha_reporte', desde);
  if (hasta) q = q.lte('fecha_reporte', hasta);

  const { data, error } = await q;
  if (error?.code === '42P01') {
    return NextResponse.json({ avances: [], aviso: 'Migración 177 pendiente' });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ avances: data ?? [] });
}
