import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ceoSecretConfigured,
  recruitmentAllowSupabaseUser,
  recruitmentCeoCookieName,
  verifyRecruitmentCeoAuthorized,
} from '@/lib/recruitment/ceo-auth';
import { hasSupabaseCeoSession } from '@/lib/recruitment/ceo-auth-server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type KanbanColumnId = 'invitados' | 'evaluando' | 'banca' | 'asignados';

function mapEmbudo(emp: { estado: string | null; estado_proceso: string | null }): KanbanColumnId | null {
  const es = (emp.estado ?? '').trim().toLowerCase();
  if (es === 'rechazado') return null;
  if (es === 'aprobado') return 'asignados';
  const ep = (emp.estado_proceso ?? '').trim();
  if (ep === 'examen_completado') return 'banca';
  if (ep === 'examen_iniciado' || ep === 'cv_completado') return 'evaluando';
  return 'invitados';
}

function notasUrgentes(notes: string | null): boolean {
  const n = (notes ?? '').toLowerCase();
  return /urgente|prioridad|cr[ií]tico|inmediato|asap/.test(n);
}

/**
 * GET: vacantes (`recruitment_needs` + `ci_proyectos`) y embudo de postulantes (`ci_empleados`)
 * para el dashboard RRHH. Misma autenticación que `/api/recruitment/candidatos-examen`.
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const authorized = verifyRecruitmentCeoAuthorized({
      req,
      cookieVal: cookieStore.get(recruitmentCeoCookieName())?.value,
      hasSupabaseUser: await hasSupabaseCeoSession(),
    });

    if (!authorized && (ceoSecretConfigured() || recruitmentAllowSupabaseUser())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) {
      return NextResponse.json({
        needs: [],
        candidatos: [],
        proyectos: [],
        hint: admin.response.status === 503 ? 'Configure SUPABASE_SERVICE_ROLE_KEY.' : undefined,
      });
    }

    const { data: needsRaw, error: needsErr } = await admin.client
      .from('recruitment_needs')
      .select(
        'id,title,notes,protocol_active,cargo_codigo,cargo_nombre,cargo_nivel,cantidad_requerida,proyecto_id,proyecto_modulo_id,created_at',
      )
      .order('created_at', { ascending: false })
      .limit(60);

    if (needsErr) {
      console.error('[dashboard-funnel] needs', needsErr);
      return NextResponse.json({ needs: [], candidatos: [], proyectos: [], error: needsErr.message });
    }

    const needsList = (needsRaw ?? []) as {
      id: string;
      title: string;
      notes: string | null;
      protocol_active: boolean | null;
      cargo_codigo: string | null;
      cargo_nombre: string | null;
      cargo_nivel: number | null;
      cantidad_requerida: number | null;
      proyecto_id: string | null;
      proyecto_modulo_id: string | null;
      created_at: string;
    }[];

    const proyectoIds = new Set<string>();
    for (const n of needsList) {
      if (n.proyecto_id) proyectoIds.add(n.proyecto_id);
      if (n.proyecto_modulo_id) proyectoIds.add(n.proyecto_modulo_id);
    }

    const nombreProyecto = new Map<string, string>();
    if (proyectoIds.size) {
      const { data: prows, error: perr } = await admin.client
        .from('ci_proyectos')
        .select('id,nombre')
        .in('id', Array.from(proyectoIds));
      if (!perr && prows) {
        for (const p of prows as { id: string; nombre: string }[]) {
          nombreProyecto.set(p.id, p.nombre);
        }
      }
    }

    const { data: empRaw, error: empErr } = await admin.client
      .from('ci_empleados')
      .select(
        'id,nombre_completo,cargo_nombre,cargo_nivel,rol_buscado,estado,estado_proceso,perfil_color,puntuacion_logica,tiempo_respuesta,recruitment_need_id',
      )
      .not('recruitment_need_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(400);

    if (empErr) {
      console.error('[dashboard-funnel] empleados', empErr);
    }

    const empleados = (empRaw ?? []) as {
      id: string;
      nombre_completo: string;
      cargo_nombre: string | null;
      cargo_nivel: number | null;
      rol_buscado: string | null;
      estado: string | null;
      estado_proceso: string | null;
      perfil_color: string | null;
      puntuacion_logica: number | null;
      tiempo_respuesta: number | null;
      recruitment_need_id: string | null;
    }[];

    const aprobadosPorNeed = new Map<string, number>();
    for (const e of empleados) {
      const nid = (e.recruitment_need_id ?? '').trim();
      if (!nid) continue;
      const es = (e.estado ?? '').trim().toLowerCase();
      if (es === 'aprobado') {
        aprobadosPorNeed.set(nid, (aprobadosPorNeed.get(nid) ?? 0) + 1);
      }
    }

    const needs = needsList.map((n) => {
      const pid = n.proyecto_modulo_id ?? n.proyecto_id;
      const proyectoNombre = pid ? nombreProyecto.get(pid) ?? 'Proyecto' : 'Sin proyecto';
      const cant = typeof n.cantidad_requerida === 'number' && n.cantidad_requerida >= 1 ? n.cantidad_requerida : 1;
      const cubiertos = aprobadosPorNeed.get(n.id) ?? 0;
      const cod = (n.cargo_codigo ?? '').trim();
      const nom = (n.cargo_nombre ?? '').trim();
      const cargo = [cod, nom].filter(Boolean).join(' · ') || (n.title ?? '').trim() || 'Vacante';
      const activa = n.protocol_active !== false;
      return {
        id: n.id,
        proyectoNombre,
        cargo,
        cantidadTotal: cant,
        cubiertos,
        urgente: activa && notasUrgentes(n.notes),
        protocolActive: activa,
      };
    });

    const candidatos: {
      id: string;
      nombre: string;
      cargo: string;
      nivel: string;
      columna: KanbanColumnId;
      perfil_color: string | null;
      puntuacion_logica: number | null;
      tiempo_respuesta: number | null;
    }[] = [];

    for (const e of empleados) {
      const col = mapEmbudo({ estado: e.estado, estado_proceso: e.estado_proceso });
      if (!col) continue;
      const nivelNum = e.cargo_nivel != null && e.cargo_nivel >= 1 && e.cargo_nivel <= 9 ? e.cargo_nivel : null;
      const nivel = nivelNum != null ? `Grupo ${nivelNum}` : '—';
      const cargo = (e.cargo_nombre ?? '').trim() || (e.rol_buscado ?? '').trim() || 'Sin cargo';
      candidatos.push({
        id: e.id,
        nombre: (e.nombre_completo ?? '').trim() || '—',
        cargo,
        nivel,
        columna: col,
        perfil_color: e.perfil_color,
        puntuacion_logica: e.puntuacion_logica,
        tiempo_respuesta: e.tiempo_respuesta,
      });
    }

    const { data: todosProy, error: proyErr } = await admin.client
      .from('ci_proyectos')
      .select('id,nombre')
      .order('nombre', { ascending: true })
      .limit(120);

    if (proyErr) {
      console.warn('[dashboard-funnel] ci_proyectos list', proyErr);
    }

    const proyectos = ((todosProy ?? []) as { id: string; nombre: string }[]).map((p) => ({
      id: p.id,
      nombre: p.nombre,
    }));

    return NextResponse.json({ needs, candidatos, proyectos });
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'digest' in e &&
      (e as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE'
    ) {
      throw e;
    }
    console.error('[dashboard-funnel] fatal', e);
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ needs: [], candidatos: [], proyectos: [], error: msg });
  }
}
