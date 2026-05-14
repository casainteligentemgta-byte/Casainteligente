import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET — Lista contratos express usando cliente admin (bypass RLS).
 * Intenta 3 estrategias en cascada para máxima compatibilidad.
 */
export async function GET() {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  // --- Estrategia 1: select con join ci_proyectos ---
  const { data: d1, error: e1 } = await admin.client
    .from('ci_contratos_express')
    .select('id,created_at,obrero_nombre,obrero_nombres,obrero_apellidos,obrero_cedula,proyecto_id,formalizado_empleado_id,ci_proyectos(nombre)')
    .order('created_at', { ascending: false });

  if (!e1 && d1 !== null) {
    return NextResponse.json(d1);
  }

  console.warn('[contratos-express GET] estrategia 1 falló:', e1?.message, '— intentando sin join');

  // --- Estrategia 2: select simple sin join ---
  const { data: d2, error: e2 } = await admin.client
    .from('ci_contratos_express')
    .select('id,created_at,obrero_nombre,obrero_cedula,proyecto_id,formalizado_empleado_id')
    .order('created_at', { ascending: false });

  if (!e2 && d2 !== null) {
    console.info('[contratos-express GET] estrategia 2 exitosa, sin join de proyecto');
    return NextResponse.json(d2);
  }

  console.warn('[contratos-express GET] estrategia 2 falló:', e2?.message, '— intentando select mínimo');

  // --- Estrategia 3: select absolutamente mínimo ---
  const { data: d3, error: e3 } = await admin.client
    .from('ci_contratos_express')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!e3 && d3 !== null) {
    console.info('[contratos-express GET] estrategia 3 exitosa (select *)');
    return NextResponse.json(d3);
  }

  // Todas fallaron — devolver error completo para diagnosis
  console.error('[contratos-express GET] todas las estrategias fallaron:', e3?.message);
  return NextResponse.json(
    {
      error: e3?.message ?? 'Error desconocido al consultar ci_contratos_express',
      code: e3?.code,
      hint: e3?.hint,
      details: e3?.details,
    },
    { status: 500 },
  );
}
