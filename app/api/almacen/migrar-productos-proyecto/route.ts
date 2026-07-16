import { NextResponse } from 'next/server';
import { migrarProductosAObra } from '@/lib/almacen/migrarProductosAObra';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      proyecto_id?: string;
      product_ids?: number[];
      ubicacion_id?: string | null;
      stock_inicial?: number;
      presupuesto_partida_id?: string | null;
      omitir_existentes?: boolean;
    };

    const proyectoId = body.proyecto_id?.trim();
    const productIds = Array.isArray(body.product_ids)
      ? body.product_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
      : [];

    if (!proyectoId) {
      return NextResponse.json({ error: 'proyecto_id es obligatorio.' }, { status: 400 });
    }
    if (!productIds.length) {
      return NextResponse.json({ error: 'Seleccione al menos un producto.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const resultado = await migrarProductosAObra(supabase, {
      proyectoId,
      productIds,
      ubicacionId: body.ubicacion_id?.trim() || null,
      stockInicial: body.stock_inicial,
      presupuestoPartidaId: body.presupuesto_partida_id?.trim() || null,
      omitirExistentes: body.omitir_existentes !== false,
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al migrar productos';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
