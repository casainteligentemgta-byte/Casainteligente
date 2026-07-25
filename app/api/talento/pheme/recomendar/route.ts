import { NextResponse } from 'next/server';
import { recomendarPruebasPheme, rolExamenParaGenerarLink } from '@/lib/talento/pheme/recomendarPruebasPheme';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/**
 * POST /api/talento/pheme/recomendar
 * Body: { palabras_clave?: string[], texto?: string }
 * Recomienda batería de pruebas Pheme según palabras clave del cargo/solicitud.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: { palabras_clave?: unknown; texto?: unknown; texto_solicitud?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const palabrasClave = Array.isArray(body.palabras_clave)
    ? body.palabras_clave.map((x) => String(x ?? ''))
    : [];
  const texto =
    typeof body.texto === 'string'
      ? body.texto
      : typeof body.texto_solicitud === 'string'
        ? body.texto_solicitud
        : '';

  if (palabrasClave.length === 0 && !texto.trim()) {
    return NextResponse.json(
      { error: 'Indica palabras_clave o texto con el cargo / solicitud' },
      { status: 400 },
    );
  }

  const result = await recomendarPruebasPheme(admin.client, {
    palabrasClave,
    textoSolicitud: texto,
  });

  return NextResponse.json({
    ...result,
    rol_examen_para_enlace: rolExamenParaGenerarLink(result.rol_examen_sugerido),
  });
}
