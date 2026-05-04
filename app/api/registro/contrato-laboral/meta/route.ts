import { NextResponse } from 'next/server';
import { contratoObreroPorToken } from '@/lib/talento/contratoObreroToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET ?contrato_id=&token= — Metadatos públicos del contrato para el obrero (validación por token_registro).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contratoId = (searchParams.get('contrato_id') ?? '').trim();
  const token = (searchParams.get('token') ?? '').trim();
  if (!contratoId || !token) {
    return NextResponse.json({ error: 'contrato_id y token requeridos' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const v = await contratoObreroPorToken(admin.client, contratoId, token);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  const { data: emp, error: e2 } = await admin.client
    .from('ci_empleados')
    .select('nombre_completo, documento, cedula')
    .eq('id', v.empleadoId)
    .maybeSingle();

  if (e2 || !emp) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  const e = emp as { nombre_completo: string | null; documento: string | null; cedula: string | null };

  return NextResponse.json({
    contrato_id: v.contratoId,
    estado_contrato: v.estadoContrato,
    obrero_aceptacion_contrato_at: v.obreroAceptacionContratoAt,
    nombre_completo: (e.nombre_completo ?? '').trim() || 'Trabajador',
    documento: (e.cedula ?? e.documento ?? '').trim() || null,
  });
}
