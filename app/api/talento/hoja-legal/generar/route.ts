import { NextResponse } from 'next/server';
import { persistirPdfHojaLegalEmpleado } from '@/lib/talento/persistirPdfHojaLegalEmpleado';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * POST { empleadoId, variante: 'hoja_vida' | 'hoja_empleo' }
 * o { token, variante } para onboarding por token_registro.
 *
 * Persiste el PDF en Storage y actualiza columnas en ci_empleados.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: { empleadoId?: string; token?: string; variante?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const varianteRaw = (body.variante ?? 'hoja_vida').trim();
  if (varianteRaw !== 'hoja_vida' && varianteRaw !== 'hoja_empleo') {
    return NextResponse.json({ error: 'variante debe ser hoja_vida o hoja_empleo' }, { status: 400 });
  }

  let empleadoId = (body.empleadoId ?? '').trim();
  const token = (body.token ?? '').trim();

  if (!empleadoId && token) {
    const byReg = await admin.client.from('ci_empleados').select('id').eq('token_registro', token).maybeSingle();
    if (byReg.error) return NextResponse.json({ error: byReg.error.message }, { status: 500 });
    empleadoId = String((byReg.data as { id?: string } | null)?.id ?? '').trim();
    if (!empleadoId) {
      const byTok = await admin.client.from('ci_empleados').select('id').eq('token', token).maybeSingle();
      if (byTok.error) return NextResponse.json({ error: byTok.error.message }, { status: 500 });
      empleadoId = String((byTok.data as { id?: string } | null)?.id ?? '').trim();
    }
  }

  if (!empleadoId) {
    return NextResponse.json({ error: 'empleadoId o token requerido' }, { status: 400 });
  }

  const out = await persistirPdfHojaLegalEmpleado(admin.client, empleadoId, varianteRaw);
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    empleadoId,
    path: out.path,
    variante: out.variante,
    nombre: out.nombre,
  });
}
