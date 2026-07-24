import { NextResponse } from 'next/server';
import { listarStockProyecto } from '@/lib/almacen/listarStockProyecto';
import { supabaseAdminMovimientos } from '@/lib/almacen/supabaseAdminMovimientos';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ubicacionId = url.searchParams.get('ubicacion_id')?.trim();
  const proyectoId = url.searchParams.get('proyecto_id')?.trim();

  const admin = supabaseAdminMovimientos();
  if (!admin.ok) return admin.response;

  const supabase = admin.client;

  if (proyectoId) {
    try {
      const items = await listarStockProyecto(supabase, proyectoId, {
        ubicacionId: ubicacionId || undefined,
        soloAlmacenesFisicos: true,
      });
      return NextResponse.json({
        ok: true,
        items,
        scope: 'proyecto',
        migracionPendiente: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al listar stock de obra';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (!ubicacionId) {
    return NextResponse.json(
      { error: 'proyecto_id o ubicacion_id requerido' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('inventario_stock')
    .select(
      `
      id,
      ubicacion_id,
      cantidad_disponible,
      cantidad_reservada,
      material:global_inventory (
        id,
        name,
        unit,
        sap_code,
        category:material_categories ( name )
      )
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
      | {
          id: string;
          name: string;
          unit: string;
          sap_code: string | null;
          category: { name: string } | Array<{ name: string }> | null;
        }
      | Array<{
          id: string;
          name: string;
          unit: string;
          sap_code: string | null;
          category: { name: string } | Array<{ name: string }> | null;
        }>
      | null;
    const mat = Array.isArray(raw) ? raw[0] : raw;
    const catRaw = mat?.category;
    const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
    return {
      material_id: mat?.id ?? '',
      ubicacion_id: String(row.ubicacion_id ?? ubicacionId),
      ubicacion_nombre: '',
      nombre: mat?.name ?? 'Material',
      unidad: mat?.unit ?? 'UND',
      sap_code: mat?.sap_code ?? null,
      categoria: cat?.name ?? null,
      cantidad_disponible: Number(row.cantidad_disponible ?? 0),
    };
  });

  return NextResponse.json({ ok: true, items });
}
