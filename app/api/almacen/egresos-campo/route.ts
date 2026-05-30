import { NextResponse } from 'next/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

/** GET /api/almacen/egresos-campo?proyecto_id=... — trazabilidad de egresos. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const proyectoId = url.searchParams.get('proyecto_id')?.trim();
  const limite = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 200);

  const supabase = createSupabaseAdminOnlyClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin no configurado.' }, { status: 503 });
  }

  let q = supabase
    .from('inv_egresos_campo')
    .select(
      `
      id,
      proyecto_id,
      obrero_nombre,
      obrero_oficio,
      observaciones,
      fecha_egreso,
      hora_egreso,
      stock_aplicado,
      transferencia_id,
      created_at,
      inv_egresos_campo_lineas (
        id,
        material_id,
        material_nombre,
        cantidad,
        unidad,
        partida_label,
        tarea_label
      )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(limite);

  if (proyectoId) {
    q = q.eq('proyecto_id', proyectoId);
  }

  const { data, error } = await q;
  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'Tabla inv_egresos_campo no instalada. Aplique migración 206.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, egresos: data ?? [] });
}
