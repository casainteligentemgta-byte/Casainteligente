import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET /api/talento/contratos-express/debug
 * Endpoint de diagnóstico — NO usar en producción para datos sensibles.
 * Devuelve estado de conexión, conteo de filas y primer registro.
 */
export async function GET() {
  const admin = supabaseAdminForRoute();

  if (!admin.ok) {
    return NextResponse.json({
      status: 'ERROR_CONFIG',
      message: 'supabaseAdminForRoute falló — revisa SUPABASE_SERVICE_ROLE_KEY en Vercel',
    }, { status: 503 });
  }

  const results: Record<string, unknown> = {};

  // Test 1: count
  const { count, error: cErr } = await admin.client
    .from('ci_contratos_express')
    .select('*', { count: 'exact', head: true });

  results.count = { value: count, error: cErr?.message ?? null };

  // Test 2: first row select *
  const { data: row, error: rErr } = await admin.client
    .from('ci_contratos_express')
    .select('*')
    .limit(1)
    .maybeSingle();

  results.first_row = {
    columns: row ? Object.keys(row) : null,
    error: rErr?.message ?? null,
    code: rErr?.code ?? null,
  };

  // Test 3: join
  const { data: joinRow, error: jErr } = await admin.client
    .from('ci_contratos_express')
    .select('id, ci_proyectos(nombre)')
    .limit(1)
    .maybeSingle();

  results.join_test = {
    data: joinRow,
    error: jErr?.message ?? null,
    code: jErr?.code ?? null,
  };

  return NextResponse.json(results);
}
