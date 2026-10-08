import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { listarCandidatosContratoMasiva } from '@/lib/talento/listarCandidatosContratoMasiva';

export const dynamic = 'force-dynamic';

/**
 * GET ?proyecto_id= — obreros de la obra que ya llenaron el enlace (HV).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const proyectoId = new URL(req.url).searchParams.get('proyecto_id')?.trim() ?? '';
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 });

  const { candidatos, error } = await listarCandidatosContratoMasiva(admin.client, proyectoId);
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({
    proyecto_id: proyectoId,
    total: candidatos.length,
    listos: candidatos.filter((c) => c.listo).length,
    candidatos,
  });
}
