import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import {
  resolveSupabasePostgrestCreds,
  restInsertRecruitmentNeed,
  restRowExistsById,
} from '@/lib/supabase/postgrest-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lista necesidades recientes (dashboard CEO). */
export async function GET() {
  if (!db) {
    return NextResponse.json(
      { error: 'database_unavailable', hint: 'Configura DATABASE_URL para registrar vacantes.' },
      { status: 503 },
    );
  }
  try {
    const rows = await db
      .select({
        id: schema.recruitmentNeeds.id,
        title: schema.recruitmentNeeds.title,
        notes: schema.recruitmentNeeds.notes,
        protocolActive: schema.recruitmentNeeds.protocolActive,
        cargoCodigo: schema.recruitmentNeeds.cargoCodigo,
        cargoNombre: schema.recruitmentNeeds.cargoNombre,
        cargoNivel: schema.recruitmentNeeds.cargoNivel,
        tipoVacante: schema.recruitmentNeeds.tipoVacante,
        proyectoId: schema.recruitmentNeeds.proyectoId,
        proyectoModuloId: schema.recruitmentNeeds.proyectoModuloId,
        proyectoNombre: sql<string>`COALESCE(${schema.ciObras.nombre}, ${schema.ciProyectos.nombre})`.as(
          'proyectoNombre',
        ),
        createdAt: schema.recruitmentNeeds.createdAt,
      })
      .from(schema.recruitmentNeeds)
      .leftJoin(schema.ciObras, eq(schema.recruitmentNeeds.proyectoId, schema.ciObras.id))
      .leftJoin(schema.ciProyectos, eq(schema.recruitmentNeeds.proyectoModuloId, schema.ciProyectos.id))
      .orderBy(desc(schema.recruitmentNeeds.createdAt))
      .limit(40);
    return NextResponse.json({ needs: rows });
  } catch (e) {
    console.error('[recruitment/needs GET]', e);
    const msg = e instanceof Error ? e.message : 'Error al listar vacantes';
    return NextResponse.json({ needs: [], error: msg });
  }
}

/** Crea una necesidad de puesto y activa el protocolo (enlace ?need=). */
export async function POST(req: Request) {
  const postgrestCreds = resolveSupabasePostgrestCreds();
  if (!postgrestCreds && !db) {
    return NextResponse.json(
      {
        error: 'database_unavailable',
        hint:
          'Configura URL de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL) y una clave (SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY), o DATABASE_URL alineada con esa base.',
      },
      { status: 503 },
    );
  }
  let body: {
    title?: string;
    notes?: string | null;
    cargo_codigo?: string;
    cargo_nombre?: string;
    cargo_nivel?: number;
    tipo_vacante?: string;
    proyecto_id?: string;
    proyecto_modulo_id?: string;
    alerta_presupuesto_ignorada?: boolean;
    notas_autorizacion?: string | null;
    cantidad_requerida?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const title = (body.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: 'title requerido' }, { status: 400 });
  }
  const notes = body.notes != null ? String(body.notes).trim() || null : null;
  const cargoCodigo = (body.cargo_codigo ?? '').trim() || null;
  const cargoNombre = (body.cargo_nombre ?? '').trim() || null;
  const rawNivel = body.cargo_nivel;
  const cargoNivel =
    typeof rawNivel === 'number' && Number.isInteger(rawNivel) && rawNivel >= 1 && rawNivel <= 9
      ? rawNivel
      : null;
  const tv = body.tipo_vacante;
  const tipoVacante =
    tv === 'obrero_basico' || tv === 'obrero_especializado' || tv === 'empleado' ? tv : null;

  if (!cargoNombre || !tipoVacante) {
    return NextResponse.json(
      { error: 'cargo requerido: cargo_nombre y tipo_vacante (obrero_basico | obrero_especializado | empleado).' },
      { status: 400 },
    );
  }

  const isEmpleado = tipoVacante === 'empleado';
  const cargoNivelFinal = isEmpleado
    ? typeof rawNivel === 'number' && Number.isInteger(rawNivel) && rawNivel >= 1 && rawNivel <= 9
      ? rawNivel
      : 1
    : cargoNivel;

  if (!isEmpleado) {
    if (!cargoCodigo || cargoNivelFinal == null) {
      return NextResponse.json(
        { error: 'Para obrero: cargo_codigo, cargo_nombre, cargo_nivel (1–9) y tipo_vacante.' },
        { status: 400 },
      );
    }
  } else if (!cargoCodigo) {
    return NextResponse.json(
      { error: 'Para empleado: indica cargo_codigo (p. ej. ADM-RRHH) y cargo_nombre.' },
      { status: 400 },
    );
  }

  const proyectoObraId = (body.proyecto_id ?? '').trim();
  const proyectoModuloId = (body.proyecto_modulo_id ?? '').trim();
  const tieneObra = proyectoObraId && UUID_RE.test(proyectoObraId);
  const tieneModulo = proyectoModuloId && UUID_RE.test(proyectoModuloId);
  if (!tieneObra && !tieneModulo) {
    return NextResponse.json(
      {
        error:
          'Indica proyecto_id (UUID en ci_obras / Talento) o proyecto_modulo_id (UUID en ci_proyectos / módulo integral).',
      },
      { status: 400 },
    );
  }

  const alertaIgnorada = Boolean(body.alerta_presupuesto_ignorada);
  const notasAuth =
    body.notas_autorizacion != null && String(body.notas_autorizacion).trim() !== ''
      ? String(body.notas_autorizacion).trim()
      : null;

  const rawCant = body.cantidad_requerida;
  const cantidadRequerida =
    typeof rawCant === 'number' && Number.isFinite(rawCant) && rawCant >= 1
      ? Math.min(500, Math.floor(rawCant))
      : 1;

  try {
    let obraId: string | null = null;
    let moduloId: string | null = null;

    if (postgrestCreds) {
      if (tieneObra) {
        const existe = await restRowExistsById(postgrestCreds, 'ci_obras', proyectoObraId);
        if (!existe) {
          return NextResponse.json(
            {
              error:
                'proyecto_id no existe en ci_obras. Crea el proyecto primero en /proyectos/nuevo.',
            },
            { status: 400 },
          );
        }
        obraId = proyectoObraId;
      }
      if (tieneModulo) {
        const existe = await restRowExistsById(postgrestCreds, 'ci_proyectos', proyectoModuloId);
        if (!existe) {
          return NextResponse.json(
            { error: 'proyecto_modulo_id no existe en ci_proyectos.' },
            { status: 400 },
          );
        }
        moduloId = proyectoModuloId;
      }

      const ins = await restInsertRecruitmentNeed(postgrestCreds, {
        title,
        notes,
        protocol_active: true,
        cargo_codigo: cargoCodigo!,
        cargo_nombre: cargoNombre,
        cargo_nivel: cargoNivelFinal,
        tipo_vacante: tipoVacante,
        proyecto_id: obraId,
        proyecto_modulo_id: moduloId,
        alerta_presupuesto_ignorada: alertaIgnorada,
        notas_autorizacion: notasAuth,
        cantidad_requerida: cantidadRequerida,
      });
      if (!ins.id) {
        return NextResponse.json({ error: 'No se pudo crear la vacante' }, { status: 500 });
      }
      return NextResponse.json({
        id: ins.id,
        title: ins.title,
        notes: ins.notes,
        cargoCodigo: ins.cargo_codigo,
        cargoNombre: ins.cargo_nombre,
        cargoNivel: ins.cargo_nivel,
        tipoVacante: ins.tipo_vacante,
        proyectoId: ins.proyecto_id,
        proyectoModuloId: ins.proyecto_modulo_id,
        createdAt: ins.created_at,
      });
    }

    if (!db) {
      return NextResponse.json(
        {
          error: 'database_unavailable',
          hint:
            'Sin DATABASE_URL: aplica en Supabase la migración 050_recruitment_needs_rls_policies.sql si el insert falla por RLS.',
        },
        { status: 503 },
      );
    }

    if (tieneObra) {
      const obra = await db
        .select({ id: schema.ciObras.id })
        .from(schema.ciObras)
        .where(eq(schema.ciObras.id, proyectoObraId))
        .limit(1);
      if (!obra[0]) {
        return NextResponse.json(
          { error: 'proyecto_id no existe en ci_obras. Crea el proyecto primero en /proyectos/nuevo.' },
          { status: 400 },
        );
      }
      obraId = proyectoObraId;
    }

    if (tieneModulo) {
      const mod = await db
        .select({ id: schema.ciProyectos.id })
        .from(schema.ciProyectos)
        .where(eq(schema.ciProyectos.id, proyectoModuloId))
        .limit(1);
      if (!mod[0]) {
        return NextResponse.json(
          { error: 'proyecto_modulo_id no existe en ci_proyectos.' },
          { status: 400 },
        );
      }
      moduloId = proyectoModuloId;
    }

    const inserted = await db
      .insert(schema.recruitmentNeeds)
      .values({
        title,
        notes,
        protocolActive: true,
        cargoCodigo,
        cargoNombre,
        cargoNivel: cargoNivelFinal,
        tipoVacante,
        proyectoId: obraId,
        proyectoModuloId: moduloId,
        alertaPresupuestoIgnorada: alertaIgnorada,
        notasAutorizacion: notasAuth,
        cantidadRequerida,
        conteoClics: 0,
      })
      .returning({
        id: schema.recruitmentNeeds.id,
        title: schema.recruitmentNeeds.title,
        notes: schema.recruitmentNeeds.notes,
        cargoCodigo: schema.recruitmentNeeds.cargoCodigo,
        cargoNombre: schema.recruitmentNeeds.cargoNombre,
        cargoNivel: schema.recruitmentNeeds.cargoNivel,
        tipoVacante: schema.recruitmentNeeds.tipoVacante,
        proyectoId: schema.recruitmentNeeds.proyectoId,
        proyectoModuloId: schema.recruitmentNeeds.proyectoModuloId,
        createdAt: schema.recruitmentNeeds.createdAt,
      });
    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: 'No se pudo crear la vacante' }, { status: 500 });
    }
    return NextResponse.json(row);
  } catch (e) {
    console.error('[recruitment/needs POST]', e);
    const msg = (e instanceof Error ? e.message : String(e)).trim() || 'Error desconocido';
    const truncated = msg.length > 600 ? `${msg.slice(0, 600)}…` : msg;
    return NextResponse.json({ error: truncated }, { status: 500 });
  }
}
