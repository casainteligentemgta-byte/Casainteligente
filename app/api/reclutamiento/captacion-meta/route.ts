import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET ?token= — Metadatos públicos de la vacante (sin auth del obrero).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get('token') ?? '').trim();
  if (token.length < 16) {
    return NextResponse.json({ error: 'token inválido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: need, error } = await admin.client
    .from('recruitment_needs')
    .select('id,title,cargo_nombre,cargo_codigo,cargo_nivel,tipo_vacante,protocol_active,proyecto_modulo_id')
    .eq('captacion_token', token)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: (error.message ?? '').includes('captacion_token')
          ? 'Migración 073: columna captacion_token en recruitment_needs.'
          : undefined,
      },
      { status: 500 },
    );
  }
  if (!need) {
    return NextResponse.json({ error: 'Enlace no válido o vacante inexistente' }, { status: 404 });
  }

  const n = need as {
    id: string;
    title: string | null;
    cargo_nombre: string | null;
    cargo_codigo: string | null;
    cargo_nivel: number | null;
    tipo_vacante: string | null;
    protocol_active: boolean | null;
    proyecto_modulo_id: string | null;
  };

  if (n.protocol_active === false) {
    return NextResponse.json({ error: 'closed', message: 'Esta vacante ya no acepta postulaciones.' }, { status: 410 });
  }

  let proyectoNombre = '';
  const pid = (n.proyecto_modulo_id ?? '').trim();
  if (pid) {
    const { data: pr } = await admin.client.from('ci_proyectos').select('nombre').eq('id', pid).maybeSingle();
    proyectoNombre = String((pr as { nombre?: string } | null)?.nombre ?? '').trim();
  }

  return NextResponse.json({
    ok: true,
    need: n,
    proyectoNombre,
  });
}
