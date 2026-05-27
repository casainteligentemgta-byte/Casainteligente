import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { listarArbolUbicacionesInventario } from '@/lib/almacen/ubicacionesInventario';
import type { TipoUbicacion } from '@/types/inventario-obra';

export const dynamic = 'force-dynamic';

const TIPOS: TipoUbicacion[] = [
  'almacen_central',
  'almacen_movil',
  'obra',
  'garantias',
  'cuarentena',
];

function parseTipo(raw: string | null): TipoUbicacion | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim() as TipoUbicacion;
  return TIPOS.includes(t) ? t : undefined;
}

/**
 * GET /api/almacen/ubicaciones
 * Devuelve el árbol de ubicaciones (almacenes, obras, subsitios).
 * Query: ?activo=false (incluir inactivas), ?tipo=obra
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const soloActivas = url.searchParams.get('activo') !== 'false';
  const tipo = parseTipo(url.searchParams.get('tipo'));

  if (url.searchParams.get('tipo') && !tipo) {
    return NextResponse.json(
      { error: `tipo inválido. Valores: ${TIPOS.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  try {
    const { arbol, total } = await listarArbolUbicacionesInventario(supabase, {
      soloActivas,
      tipo,
    });

    return NextResponse.json({
      ok: true,
      arbol,
      total,
      migracionPendiente: total === 0,
      hint:
        total === 0
          ? 'Si no aplicó las migraciones 180/181, ejecute npm run db:apply o el SQL en Supabase.'
          : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al listar ubicaciones';
    console.error('[GET /api/almacen/ubicaciones]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
