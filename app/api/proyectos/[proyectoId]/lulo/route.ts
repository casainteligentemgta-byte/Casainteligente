import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { proyectoId: string } },
) {
  try {
    const proyectoId = params.proyectoId?.trim();
    if (!proyectoId) {
      return NextResponse.json({ error: 'proyectoId requerido' }, { status: 400 });
    }

    const supabase = await createClient();

    const [partidasRes, gastosRes, snapshotsRes, proyectoRes] = await Promise.all([
      supabase
        .from('ci_presupuesto_partidas')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .in('origen', ['lulo_csv', 'lulo_mdb'])
        .order('codigo_partida'),
      supabase
        .from('gastos_obra')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .in('origen', ['lulo_csv', 'lulo_mdb'])
        .order('fecha', { ascending: false }),
      supabase
        .from('ci_lulo_import_snapshots')
        .select('id, nombre_archivo, formato, resumen, created_at')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('ci_proyectos').select('id, nombre').eq('id', proyectoId).maybeSingle(),
    ]);

    if (partidasRes.error) throw partidasRes.error;
    if (gastosRes.error) throw gastosRes.error;
    if (snapshotsRes.error) {
      console.warn('[GET lulo] snapshots:', snapshotsRes.error.message);
    }

    return NextResponse.json({
      proyecto: proyectoRes.data,
      partidas: partidasRes.data ?? [],
      gastos: gastosRes.data ?? [],
      snapshots: snapshotsRes.data ?? [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar datos Lulo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
