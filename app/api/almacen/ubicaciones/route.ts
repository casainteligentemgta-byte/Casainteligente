import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  etiquetaUbicacionSelector,
  listarArbolUbicacionesInventario,
  listarUbicacionesParaSelector,
  listarUbicacionesPorEntidad,
} from '@/lib/almacen/ubicacionesInventario';
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
  const proyectoId = url.searchParams.get('proyecto_id')?.trim() || undefined;
  const entidadId = url.searchParams.get('entidad_id')?.trim() || undefined;
  const excluirProyectoId = url.searchParams.get('excluir_proyecto_id')?.trim() || undefined;
  const flat = url.searchParams.get('flat') === '1';
  const soloAlmacenes = url.searchParams.get('solo_almacenes') === '1';

  if (url.searchParams.get('tipo') && !tipo) {
    return NextResponse.json(
      { error: `tipo inválido. Valores: ${TIPOS.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());

  try {
    if (flat) {
      const ubicaciones = entidadId
        ? await listarUbicacionesPorEntidad(supabase, entidadId, {
            excluirProyectoId,
          })
        : await listarUbicacionesParaSelector(supabase, {
            soloActivas,
            tipo,
            proyectoId,
            soloAlmacenes,
          });
      return NextResponse.json({
        ok: true,
        ubicaciones: ubicaciones.map((u, i, arr) => ({
          ...u,
          etiqueta: etiquetaUbicacionSelector(u, indentNivel(u, arr)),
        })),
        total: ubicaciones.length,
        migracionPendiente: ubicaciones.length === 0 && !proyectoId,
        hint:
          ubicaciones.length === 0
            ? 'Si no aplicó las migraciones 180/181, ejecute npm run db:apply o el SQL en Supabase.'
            : undefined,
      });
    }

    const { arbol, total } = await listarArbolUbicacionesInventario(supabase, {
      soloActivas,
      tipo,
      proyectoId,
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

function indentNivel(
  u: { ubicacion_padre_id?: string | null; id: string },
  flat: Array<{ id: string; ubicacion_padre_id?: string | null }>,
): number {
  let n = 0;
  let pid = u.ubicacion_padre_id;
  const byId = new Map(flat.map((x) => [x.id, x]));
  while (pid && n < 5) {
    n += 1;
    pid = byId.get(pid)?.ubicacion_padre_id;
  }
  return n;
}
