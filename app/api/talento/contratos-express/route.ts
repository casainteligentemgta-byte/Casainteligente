import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET — Lista contratos express usando cliente admin (bypass RLS).
 * Intenta 3 estrategias en cascada para máxima compatibilidad.
 */
export async function GET() {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.client
    .from('ci_contratos_express')
    .select('id,created_at,obrero_nombre,obrero_nombres,obrero_apellidos,obrero_cedula,proyecto_id,formalizado_empleado_id,ci_proyectos(nombre)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[contratos-express GET] error:', error.message);
    return NextResponse.json(
      {
        error: error.message ?? 'Error al consultar ci_contratos_express',
        code: error.code,
        hint: error.hint,
        details: error.details,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
