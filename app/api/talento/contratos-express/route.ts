import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET — Obtiene el listado de contratos express usando el cliente admin (bypass RLS).
 * Esto soluciona problemas de visibilidad en el frontend cuando el RLS no está configurado.
 */
export async function GET() {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    // Intentamos obtener con la relación de proyectos
    const { data, error } = await admin.client
      .from('ci_contratos_express')
      .select('id,created_at,obrero_nombre,obrero_cedula,proyecto_id,formalizado_empleado_id,ci_proyectos(nombre)')
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback si la relación ci_proyectos falla o faltan columnas
      console.warn('[API contratos-express GET] fallback a select simple', error.message);
      
      const { data: liteData, error: liteError } = await admin.client
        .from('ci_contratos_express')
        .select('id,created_at,obrero_nombre,obrero_cedula,proyecto_id,formalizado_empleado_id')
        .order('created_at', { ascending: false });

      if (liteError) {
        return NextResponse.json({ error: liteError.message }, { status: 500 });
      }
      
      return NextResponse.json(liteData);
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('[API contratos-express GET] catch', e);
    return NextResponse.json({ error: 'Fallo interno al recuperar contratos' }, { status: 500 });
  }
}
