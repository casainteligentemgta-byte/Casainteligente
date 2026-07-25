import { NextResponse } from 'next/server';
import { mapaEvaluacionDesdeRol } from '@/lib/talento/psique/mapaEvaluacion';
import {
  recomendarPruebasPsique,
  rolExamenDesdePsique,
} from '@/lib/talento/psique/recomendarPruebasPsique';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/**
 * POST /api/talento/psique/recomendar
 * Body: { palabras_clave?: string[], texto?: string }
 * Recomienda batería Psique + mapa al semáforo del libro de evaluación.
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

  const result = await recomendarPruebasPsique(admin.client, {
    palabrasClave,
    textoSolicitud: texto,
  });

  const rol = rolExamenDesdePsique(result.rol_examen_sugerido);
  const evaluacion = mapaEvaluacionDesdeRol(rol);

  return NextResponse.json({
    ...result,
    rol_examen_sugerido: rol,
    /** Rol completo para generar-link / captación (4 bancos). */
    rol_examen_para_enlace: rol,
    evaluacion,
  });
}
