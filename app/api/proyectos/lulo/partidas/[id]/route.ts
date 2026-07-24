import { createClient } from '@/lib/supabase/server';
import { montoPartidaDesdeCantidadPrecio, toPgNumeric15_2, toPgNumeric15_4 } from '@/lib/utils/numericDbLimits';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const allowed = [
      'codigo_partida',
      'descripcion',
      'unidad',
      'cantidad_presupuestada',
      'precio_unitario_estimado',
      'monto_total_estimado',
    ];
    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 });
    }

    if (update.cantidad_presupuestada !== undefined) {
      update.cantidad_presupuestada = toPgNumeric15_4(Number(update.cantidad_presupuestada));
    }
    if (update.precio_unitario_estimado !== undefined) {
      update.precio_unitario_estimado = toPgNumeric15_4(Number(update.precio_unitario_estimado));
    }
    if (update.monto_total_estimado !== undefined) {
      const cantidad = toPgNumeric15_4(Number(update.cantidad_presupuestada ?? 0));
      const precio = toPgNumeric15_4(Number(update.precio_unitario_estimado ?? 0));
      const montoRaw = Number(update.monto_total_estimado);
      update.monto_total_estimado =
        update.cantidad_presupuestada !== undefined || update.precio_unitario_estimado !== undefined
          ? montoPartidaDesdeCantidadPrecio(cantidad, precio, montoRaw)
          : toPgNumeric15_2(montoRaw);
    }

    update.updated_at = new Date().toISOString();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ci_presupuesto_partidas')
      .update(update)
      .eq('id', params.id)
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar partida';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('ci_presupuesto_partidas').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al borrar partida';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
