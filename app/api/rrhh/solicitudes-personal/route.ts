import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { cargoPorCodigo, tipoVacantePorNivel } from '@/lib/constants/cargosObreros';
import { baseUrlPublica, enlacesAbiertosSolicitud } from '@/lib/rrhh/solicitudPersonalServer';

export const dynamic = 'force-dynamic';

async function exigirSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

type NeedRow = {
  id: string;
  title: string | null;
  cargo_codigo: string | null;
  cargo_nombre: string | null;
  cargo_nivel: number | null;
  cantidad_requerida: number | null;
  protocol_active: boolean | null;
  created_at: string;
};

type EmpRow = {
  id: string;
  nombre_completo: string | null;
  cedula: string | null;
  celular: string | null;
  telefono: string | null;
  cargo_codigo: string | null;
  cargo_nombre: string | null;
  estado_proceso: string | null;
  estado: string | null;
  estatus_evaluacion: string | null;
  semaforo: string | null;
  token_registro: string | null;
  recruitment_need_id: string | null;
  created_at: string;
};

const EMP_SELECT =
  'id,nombre_completo,cedula,celular,telefono,cargo_codigo,cargo_nombre,estado_proceso,estado,estatus_evaluacion,semaforo,token_registro,recruitment_need_id,created_at';

/**
 * GET ?proyecto_id= → solicitudes de personal de la obra, sus enlaces abiertos (con y sin evaluación)
 * y quiénes respondieron a cada una.
 */
export async function GET(req: Request) {
  const user = await exigirSesion();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const db = admin.client;

  const proyectoId = new URL(req.url).searchParams.get('proyecto_id')?.trim() ?? '';
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 });
  const base = baseUrlPublica(req);

  const { data: needs, error: eN } = await db
    .from('recruitment_needs')
    .select('id,title,cargo_codigo,cargo_nombre,cargo_nivel,cantidad_requerida,protocol_active,created_at')
    .eq('proyecto_modulo_id', proyectoId)
    .order('created_at', { ascending: true });
  if (eN) return NextResponse.json({ error: eN.message }, { status: 500 });
  const solicitudes = (needs ?? []) as NeedRow[];
  const needIds = solicitudes.map((n) => n.id);

  const porObra = await db.from('ci_empleados').select(EMP_SELECT).eq('proyecto_modulo_id', proyectoId).limit(1000);
  if (porObra.error) return NextResponse.json({ error: porObra.error.message }, { status: 500 });
  const empleados = new Map<string, EmpRow>();
  for (const r of (porObra.data ?? []) as EmpRow[]) empleados.set(r.id, r);
  if (needIds.length) {
    const porNeed = await db.from('ci_empleados').select(EMP_SELECT).in('recruitment_need_id', needIds).limit(1000);
    for (const r of (porNeed.data ?? []) as EmpRow[]) empleados.set(r.id, r);
  }

  // Evaluación pedida y aún no presentada = invitación sin usar.
  const ids = Array.from(empleados.keys());
  const pendienteEval = new Set<string>();
  if (ids.length) {
    const { data: ex } = await db.from('ci_examenes').select('empleado_id,usado_at').in('empleado_id', ids);
    for (const r of (ex ?? []) as Array<{ empleado_id: string; usado_at: string | null }>) {
      if (!r.usado_at) pendienteEval.add(r.empleado_id);
    }
  }

  const vista = (e: EmpRow) => {
    const etapa =
      e.estado_proceso === 'descartado'
        ? 'descartado'
        : e.estado_proceso === 'cv_completado'
          ? 'hoja_lista'
          : 'enlace_enviado';
    const evaluado = (e.estatus_evaluacion ?? '') === 'completado';
    const evaluacion = evaluado ? 'hecha' : pendienteEval.has(e.id) ? 'pendiente' : 'no_pedida';
    const token = (e.token_registro ?? '').trim();
    return {
      id: e.id,
      nombre: e.nombre_completo ?? '',
      cedula: e.cedula ?? '',
      whatsapp: e.celular && !/pendiente/i.test(e.celular) ? e.celular : (e.telefono ?? ''),
      oficio: [String(e.cargo_codigo ?? '').replace('.', ','), e.cargo_nombre].filter(Boolean).join(' '),
      cargo_codigo: e.cargo_codigo,
      etapa,
      evaluacion,
      resultado: evaluado ? (e.semaforo ?? e.estado ?? '') : '',
      enlace_hoja_vida: etapa === 'enlace_enviado' && token && base ? `${base}/reclutamiento/onboarding/${token}` : null,
      enlace_evaluacion:
        evaluacion === 'pendiente' && token && base ? `${base}/talento/evaluacion?token=${encodeURIComponent(token)}` : null,
      solicitud_id: e.recruitment_need_id,
    };
  };

  const todos = Array.from(empleados.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const enSolicitud = new Set(needIds);

  return NextResponse.json({
    solicitudes: solicitudes.map((n) => {
      const registrados = todos.filter((e) => e.recruitment_need_id === n.id).map(vista);
      const enlaces = base ? enlacesAbiertosSolicitud(base, n.id) : { sin: '', con: '' };
      return {
        id: n.id,
        general: !(n.cargo_codigo ?? '').trim(),
        oficio: n.cargo_nombre ?? n.title ?? 'Solicitud',
        codigo: n.cargo_codigo,
        nivel: n.cargo_nivel,
        plazas: Math.max(1, Number(n.cantidad_requerida ?? 1)),
        cubiertas: registrados.filter((r) => r.etapa === 'hoja_lista').length,
        abierta: n.protocol_active !== false,
        enlace_sin_evaluacion: enlaces.sin,
        enlace_con_evaluacion: enlaces.con,
        registrados,
      };
    }),
    sin_solicitud: todos.filter((e) => !e.recruitment_need_id || !enSolicitud.has(e.recruitment_need_id)).map(vista),
  });
}

/**
 * POST { proyecto_id, lineas: [{ oficio, cantidad }] } → crea una solicitud por oficio.
 * Si ya hay una solicitud abierta de ese oficio en la obra, le suma las plazas.
 */
export async function POST(req: Request) {
  const user = await exigirSesion();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const db = admin.client;

  let body: { proyecto_id?: string; lineas?: Array<{ oficio?: string; cantidad?: number }> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const proyectoId = String(body.proyecto_id ?? '').trim();
  const lineas = Array.isArray(body.lineas) ? body.lineas : [];
  if (!proyectoId) return NextResponse.json({ error: 'Elige la obra.' }, { status: 400 });

  const { data: proyecto } = await db.from('ci_proyectos').select('id,nombre').eq('id', proyectoId).maybeSingle();
  if (!proyecto) return NextResponse.json({ error: 'La obra no existe.' }, { status: 404 });

  const pedidas: Array<{ codigo: string; nombre: string; nivel: number; cantidad: number }> = [];
  for (const l of lineas) {
    const cargo = cargoPorCodigo(String(l.oficio ?? '').trim().replace(',', '.'));
    const cantidad = Math.max(1, Math.min(9999, Math.floor(Number(l.cantidad) || 0)));
    if (!cargo) continue;
    const ya = pedidas.find((p) => p.codigo === cargo.codigo);
    if (ya) ya.cantidad += cantidad;
    else pedidas.push({ codigo: cargo.codigo, nombre: cargo.nombre, nivel: cargo.nivel, cantidad });
  }
  if (!pedidas.length) return NextResponse.json({ error: 'Elige al menos un oficio y su cantidad.' }, { status: 400 });

  const { data: abiertas } = await db
    .from('recruitment_needs')
    .select('id,cargo_codigo,cantidad_requerida,protocol_active')
    .eq('proyecto_modulo_id', proyectoId);
  const porCodigo = new Map<string, { id: string; cantidad: number }>();
  for (const r of (abiertas ?? []) as Array<{
    id: string;
    cargo_codigo: string | null;
    cantidad_requerida: number | null;
    protocol_active: boolean | null;
  }>) {
    if (r.protocol_active !== false && r.cargo_codigo) {
      porCodigo.set(r.cargo_codigo, { id: r.id, cantidad: Number(r.cantidad_requerida ?? 0) });
    }
  }

  const errores: string[] = [];
  let creadas = 0;
  for (const p of pedidas) {
    const previa = porCodigo.get(p.codigo);
    if (previa) {
      const total = previa.cantidad + p.cantidad;
      const { error } = await db
        .from('recruitment_needs')
        .update({ cantidad_requerida: total, title: `${total}× ${p.nombre}` } as never)
        .eq('id', previa.id);
      if (error) errores.push(error.message);
      else creadas += 1;
      continue;
    }
    const { error } = await db.from('recruitment_needs').insert({
      title: `${p.cantidad}× ${p.nombre}`,
      notes: 'Solicitud de personal (RRHH).',
      proyecto_modulo_id: proyectoId,
      cargo_codigo: p.codigo,
      cargo_nombre: p.nombre,
      cargo_nivel: p.nivel,
      nivel_tabulador: p.nivel,
      cargo_solicitado: `${p.nombre} (${p.codigo})`,
      tipo_vacante: tipoVacantePorNivel(p.nivel),
      cantidad_requerida: p.cantidad,
      estado_vacante: 'abierta',
      protocol_active: true,
    } as never);
    if (error) errores.push(error.message);
    else creadas += 1;
  }

  if (!creadas) return NextResponse.json({ error: errores[0] ?? 'No se pudo crear la solicitud.' }, { status: 500 });
  return NextResponse.json({ ok: true, creadas, errores });
}

/** PATCH { id, accion: 'cerrar' | 'reabrir' | 'plazas', plazas? } */
export async function PATCH(req: Request) {
  const user = await exigirSesion();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: { id?: string; accion?: string; plazas?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Falta la solicitud.' }, { status: 400 });

  let patch: Record<string, unknown> | null = null;
  if (body.accion === 'cerrar') patch = { protocol_active: false, estado_vacante: 'cerrada' };
  if (body.accion === 'reabrir') patch = { protocol_active: true, estado_vacante: 'abierta' };
  if (body.accion === 'plazas') {
    const plazas = Math.max(1, Math.min(9999, Math.floor(Number(body.plazas) || 0)));
    patch = { cantidad_requerida: plazas };
  }
  if (!patch) return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });

  const { error } = await admin.client.from('recruitment_needs').update(patch as never).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE ?id= — solo si nadie respondió todavía; si ya hay registrados, se cierra en vez de borrar. */
export async function DELETE(req: Request) {
  const user = await exigirSesion();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const id = new URL(req.url).searchParams.get('id')?.trim() ?? '';
  if (!id) return NextResponse.json({ error: 'Falta la solicitud.' }, { status: 400 });

  const { count } = await admin.client
    .from('ci_empleados')
    .select('id', { count: 'exact', head: true })
    .eq('recruitment_need_id', id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Ya hay trabajadores registrados en esta solicitud. Ciérrala en vez de borrarla.' },
      { status: 409 },
    );
  }
  const { error } = await admin.client.from('recruitment_needs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
