import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import type { Permiso } from '@/lib/auth/permisosCatalogo';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { calcularCuellosBotella, enviarAvisosCuellosBotella } from '@/lib/compras/cuellosBotella';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cualquiera que mueva una etapa de la cadena puede ver el tablero. */
const PERMISOS_VER: Permiso[] = [
  'admin.config',
  'procura.aprobar',
  'procura.ejecutar_compra',
  'almacen.cuarentena',
  'almacen.ingreso',
  'almacen.despacho',
];

async function puedeVer() {
  let ultimo: Awaited<ReturnType<typeof requirePermisoWeb>> | null = null;
  for (const p of PERMISOS_VER) {
    ultimo = await requirePermisoWeb(p);
    if (ultimo.ok) return ultimo;
    if (ultimo.response.status === 401) return ultimo;
  }
  return ultimo!;
}

export async function GET(req: Request) {
  const auth = await puedeVer();
  if (!auth.ok) return auth.response;
  try {
    const proyectoId = new URL(req.url).searchParams.get('proyecto_id');
    const resumen = await calcularCuellosBotella(createSupabaseAdminClient(), { proyectoId });
    return NextResponse.json(resumen);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo calcular';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** «Enviar avisos ahora»: el mismo aviso del cron, a demanda. Sólo administración. */
export async function POST() {
  const auth = await requirePermisoWeb('admin.config');
  if (!auth.ok) return auth.response;
  try {
    const result = await enviarAvisosCuellosBotella(createSupabaseAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudieron enviar los avisos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
