import { postMigrarLuloMdbNativo } from '@/lib/proyectos/migrarLuloMdbNativo';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
  normalizarProyectoIdCandidato,
} from '@/lib/proyectos/validarProyectoUuid';
import { NextResponse } from 'next/server';

import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type RouteContext = { params: { proyectoId: string } };

/**
 * POST /api/proyectos/:proyectoId/presupuesto/migrar-lulo
 *
 * Migración masiva Lulo (INSUMOS, OBRAS, PARTIDAS, COMPOSICION) al esquema Casa Inteligente:
 * - ci_lulo_insumos_maestro
 * - ci_presupuesto_partidas (+ APU en ci_presupuesto_partida_apu)
 * - metadatos obra en ci_proyectos (codigo_lulo, % admin/utilidad/FCM)
 *
 * multipart: file (mdb/accdb), reemplazar?, codigoObra? (filtra partidas por Cod_Obr)
 *
 * Usa SUPABASE_SERVICE_ROLE_KEY si está definida (recomendado para migración masiva).
 */
export async function POST(req: Request, { params }: RouteContext) {
  const acceso = await requireAlgunPermisoWeb(['admin.config']);
  if (!acceso.ok) return acceso.response;

  const proyectoId = params.proyectoId?.trim();
  if (!proyectoId) {
    return NextResponse.json({ error: 'proyectoId requerido en la URL' }, { status: 400 });
  }
  return postMigrarLuloMdbNativo(req, proyectoId);
}
