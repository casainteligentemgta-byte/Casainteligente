import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { nombresLegadoDesdeTextoLibre } from '@/lib/registro/ciEmpleadosNombresLegado';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import type { RolExamen } from '@/types/talento';

function trimBase(u: string): string {
  return u.trim().replace(/\/$/, '');
}

/**
 * URL pública para enlaces (WhatsApp, QR). Prioridad: cabecera Origin (navegador mismo origen),
 * cuerpo `public_base_url` (cliente), variables de entorno.
 */
function resolvePublicAppUrl(req: Request, bodyPublicBase?: string): string {
  const origin = trimBase(req.headers.get('origin') ?? '');
  if (origin && /^https?:\/\//i.test(origin)) return origin;

  const fromBody = trimBase(bodyPublicBase ?? '');
  if (fromBody && /^https?:\/\//i.test(fromBody)) return fromBody;

  return trimBase(process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
}

/**
 * POST: crea fila mínima en ci_empleados + ci_examenes con token TTL 15 min.
 * Requiere SUPABASE_SERVICE_ROLE_KEY (no uses la anon key aquí).
 * Opcional: TALENTO_GENERAR_LINK_SECRET → header Authorization: Bearer <secret>
 */
export async function POST(req: Request) {
  const secret = process.env.TALENTO_GENERAR_LINK_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get('authorization');
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (bearer !== secret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: {
    nombre?: string;
    whatsapp?: string;
    rol_examen?: RolExamen;
    rol_buscado?: string;
    /** UUID en `ci_proyectos` (módulo integral) para planilla de empleo / PDF. */
    proyecto_modulo_id?: string;
    /** Origen del CRM (ej. https://tudominio.com); refuerzo si falta Origin en el POST. */
    public_base_url?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const nombre = (body.nombre ?? '').trim();
  const whatsapp = (body.whatsapp ?? '').trim();
  const rolExamen: RolExamen =
    body.rol_examen === 'programador' || body.rol_examen === 'tecnico' ? body.rol_examen : 'tecnico';
  const rolBuscado = (body.rol_buscado ?? '').trim() || 'Candidato (enlace de invitación)';
  const proyectoModuloId = (body.proyecto_modulo_id ?? '').trim();

  if (!nombre) {
    return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
  }

  const baseUrl = resolvePublicAppUrl(req, body.public_base_url);
  if (!baseUrl) {
    return NextResponse.json(
      {
        error: 'config',
        hint:
          'No se pudo determinar la URL pública de los enlaces. Abre el CRM con http:// o https:// (no uses file://) o define NEXT_PUBLIC_BASE_URL con tu dominio (ej. https://tudominio.com).',
      },
      { status: 503 },
    );
  }

  const supabase = admin.client;

  const token = randomUUID();
  /** Ventana amplia: onboarding por WhatsApp puede tardar días; el examen sigue limitado a 15 min en UI al iniciar. */
  const expiraAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const insertRow: Record<string, unknown> = {
    nombre_completo: nombre,
    nombres: nombresLegadoDesdeTextoLibre(nombre),
    cargo: rolBuscado,
    telefono: whatsapp || null,
    token,
    token_registro: token,
    estado_proceso: 'pendiente_cv',
    rol_examen: rolExamen,
    rol_buscado: rolBuscado,
    respuestas_personalidad: {},
    respuestas_logica: {},
  };
  if (proyectoModuloId) {
    insertRow.proyecto_modulo_id = proyectoModuloId;
  }

  const { data: empleado, error: errEmp } = await supabase.from('ci_empleados').insert(insertRow as never)
    .select('id')
    .single();

  if (errEmp || !empleado) {
    console.error('[talento generar-link] empleado', errEmp);
    const hint =
      (errEmp?.message ?? '').includes('proyecto_modulo_id') || (errEmp?.message ?? '').includes('schema cache')
        ? 'Si acabas de añadir proyecto al enlace: ejecuta migración 063 (ci_empleados.proyecto_modulo_id) y recarga el esquema en Supabase.'
        : 'Revisa migraciones 025–029 (ci_empleados, ci_examenes) y columnas de onboarding.';
    return NextResponse.json(
      { error: errEmp?.message ?? 'No se pudo crear el empleado', hint },
      { status: 500 },
    );
  }

  const row = empleado as { id: string };

  const { error: errExa } = await supabase.from('ci_examenes').insert({
    empleado_id: row.id,
    token,
    expira_at: expiraAt,
  } as never);

  if (errExa) {
    console.error('[talento generar-link] examen', errExa);
    await supabase.from('ci_empleados').delete().eq('id', row.id);
    return NextResponse.json(
      {
        error: errExa.message,
        hint:
          'En Supabase SQL Editor ejecuta supabase/migrations/082_ci_examenes_ensure_postgrest.sql (o 029+030). Luego recarga el esquema API si hace falta.',
      },
      { status: 500 },
    );
  }

  const examUrl = `${baseUrl}/talento/examen?token=${encodeURIComponent(token)}`;
  const onboardingUrl = `${baseUrl}/reclutamiento/onboarding/${token}`;

  return NextResponse.json({
    url: examUrl,
    onboarding_url: onboardingUrl,
    expira_at: expiraAt,
    empleado_id: row.id,
    token,
  });
}
