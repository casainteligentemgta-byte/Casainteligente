import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ubicacionId = new URL(req.url).searchParams.get('ubicacion_id')?.trim();
  if (!ubicacionId) {
    return NextResponse.json({ error: 'ubicacion_id requerido' }, { status: 400 });
  }

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  const { data, error } = await supabase
    .from('inventario_stock')
    .select(
      `
      id,
      cantidad_disponible,
      cantidad_reservada,
      material:global_inventory ( id, name, unit, sap_code )
    `,
    )
    .eq('ubicacion_id', ubicacionId)
    .gt('cantidad_disponible', 0)
    .order('cantidad_disponible', { ascending: false });

  if (error?.code === '42P01') {
    return NextResponse.json({
      ok: true,
      items: [],
      migracionPendiente: true,
    });
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((row) => {
    const raw = row.material as
      | { id: string; name: string; unit: string; sap_code: string | null }
      | Array<{ id: string; name: string; unit: string; sap_code: string | null }>
      | null;
    const mat = Array.isArray(raw) ? raw[0] : raw;
    return {
      material_id: mat?.id ?? '',
      nombre: mat?.name ?? 'Material',
      unidad: mat?.unit ?? 'UND',
      sap_code: mat?.sap_code ?? null,
      cantidad_disponible: Number(row.cantidad_disponible ?? 0),
    };
  });

  return NextResponse.json({ ok: true, items });
}
