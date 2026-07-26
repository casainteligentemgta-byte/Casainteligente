import { NextResponse } from 'next/server';
import {
  rolExamenDesdeNombreCargo,
  textoSolicitudDesdeCargo,
  type TipoPersonalPsique,
} from '@/lib/talento/psique/cargoARolExamen';
import { geminiAfinarRolExamen } from '@/lib/talento/psique/geminiAfinarRol';
import { mapaEvaluacionDesdeRol } from '@/lib/talento/psique/mapaEvaluacion';
import {
  recomendarPruebasPsique,
  rolExamenDesdePsique,
  type RolExamenPsique,
} from '@/lib/talento/psique/recomendarPruebasPsique';
import { alinearRolExamenConTipoVacante } from '@/lib/talento/rolesExamenCatalogo';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/**
 * POST /api/talento/psique/recomendar
 * Body:
 * - { palabras_clave?, texto? }  (libre)
 * - { cargo, tipo_personal: 'obrero'|'empleado', cargo_id?, usar_ia? }
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: {
    palabras_clave?: unknown;
    texto?: unknown;
    texto_solicitud?: unknown;
    cargo?: unknown;
    cargo_id?: unknown;
    tipo_personal?: unknown;
    usar_ia?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const tipoRaw = String(body.tipo_personal ?? '').trim().toLowerCase();
  const tipoPersonal: TipoPersonalPsique | null =
    tipoRaw === 'obrero' || tipoRaw === 'empleado' ? tipoRaw : null;

  const cargoNombre = typeof body.cargo === 'string' ? body.cargo.trim() : '';
  const cargoId = typeof body.cargo_id === 'string' ? body.cargo_id.trim() : '';

  const palabrasClave = Array.isArray(body.palabras_clave)
    ? body.palabras_clave.map((x) => String(x ?? ''))
    : [];

  let texto =
    typeof body.texto === 'string'
      ? body.texto
      : typeof body.texto_solicitud === 'string'
        ? body.texto_solicitud
        : '';

  if (cargoNombre && tipoPersonal) {
    texto = textoSolicitudDesdeCargo({
      tipoPersonal,
      cargoId: cargoId || cargoNombre,
      cargoNombre,
    });
  }

  if (palabrasClave.length === 0 && !texto.trim()) {
    return NextResponse.json(
      { error: 'Indica cargo + tipo_personal, o texto / palabras_clave' },
      { status: 400 },
    );
  }

  const result = await recomendarPruebasPsique(admin.client, {
    palabrasClave,
    textoSolicitud: texto,
  });

  let rol: RolExamenPsique = rolExamenDesdePsique(result.rol_examen_sugerido);
  let gemini = false;
  let nota_ia: string | null = null;

  if (cargoNombre && tipoPersonal) {
    const heuristico = rolExamenDesdeNombreCargo(cargoNombre, tipoPersonal);
    // Preferir heurística de cargo si el RPC no trajo rol o chocó con el tipo
    if (!result.rol_examen_sugerido) {
      rol = heuristico;
    }
    rol = alinearRolExamenConTipoVacante(
      rol,
      tipoPersonal === 'obrero' ? 'obrero' : 'empleado',
    );

    if (body.usar_ia !== false) {
      const ia = await geminiAfinarRolExamen({
        cargo: cargoNombre,
        tipoPersonal,
        rolHeuristico: heuristico,
      });
      if (ia) {
        rol = alinearRolExamenConTipoVacante(
          ia.rol,
          tipoPersonal === 'obrero' ? 'obrero' : 'empleado',
        );
        gemini = true;
        nota_ia = ia.nota ?? null;
      }
    }
  } else if (tipoPersonal) {
    rol = alinearRolExamenConTipoVacante(
      rol,
      tipoPersonal === 'obrero' ? 'obrero' : 'empleado',
    );
  }

  const evaluacion = mapaEvaluacionDesdeRol(rol);

  return NextResponse.json({
    ...result,
    rol_examen_sugerido: rol,
    rol_examen_para_enlace: rol,
    evaluacion,
    gemini,
    nota_ia,
    tipo_personal: tipoPersonal,
    cargo: cargoNombre || null,
  });
}
