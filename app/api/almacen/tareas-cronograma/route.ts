import { NextResponse } from 'next/server';
import { listarTareasCronogramaPartida } from '@/lib/almacen/listarTareasCronogramaPartida';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/almacen/tareas-cronograma?proyecto_id=&partida_id= — actividades Gantt. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const proyectoId = url.searchParams.get('proyecto_id')?.trim();
  const partidaId = url.searchParams.get('partida_id')?.trim() || undefined;

  if (!proyectoId) {
    return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 });
  }

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
  try {
    const tareas = await listarTareasCronogramaPartida(supabase, {
      proyectoId,
      ciPresupuestoPartidaId: partidaId,
    });
    return NextResponse.json({ ok: true, tareas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al listar actividades';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
