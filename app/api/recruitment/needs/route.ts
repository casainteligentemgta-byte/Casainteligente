import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';

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
        proyectoNombre: schema.ciObras.nombre,
        createdAt: schema.recruitmentNeeds.createdAt,
      })
      .from(schema.recruitmentNeeds)
      .leftJoin(schema.ciObras, eq(schema.recruitmentNeeds.proyectoId, schema.ciObras.id))
      .orderBy(desc(schema.recruitmentNeeds.createdAt))
      .limit(40);
    return NextResponse.json({ needs: rows });
  } catch (e) {
    console.error('[recruitment/needs GET]', e);
    return NextResponse.json({ error: 'Error al listar vacantes' }, { status: 500 });
  }
}

/** Crea una necesidad de puesto y activa el protocolo (enlace ?need=). */
export async function POST(req: Request) {
  if (!db) {
    return NextResponse.json(
      { error: 'database_unavailable', hint: 'Configura DATABASE_URL para registrar vacantes.' },
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
    tv === 'obrero_basico' || tv === 'obrero_especializado' ? tv : null;
  if (!cargoCodigo || !cargoNombre || cargoNivel == null || !tipoVacante) {
    return NextResponse.json(
      { error: 'cargo requerido: cargo_codigo, cargo_nombre, cargo_nivel, tipo_vacante' },
      { status: 400 },
    );
  }

  const proyectoId = (body.proyecto_id ?? '').trim();
  if (!proyectoId || !UUID_RE.test(proyectoId)) {
    return NextResponse.json(
      { error: 'proyecto_id requerido (UUID de ci_obras / proyecto registrado).' },
      { status: 400 },
    );
  }

  const obra = await db
    .select({ id: schema.ciObras.id })
    .from(schema.ciObras)
    .where(eq(schema.ciObras.id, proyectoId))
    .limit(1);
  if (!obra[0]) {
    return NextResponse.json(
      { error: 'proyecto_id no existe en ci_obras. Crea el proyecto primero en /proyectos/nuevo.' },
      { status: 400 },
    );
  }

  try {
    const inserted = await db
      .insert(schema.recruitmentNeeds)
      .values({
        title,
        notes,
        protocolActive: true,
        cargoCodigo,
        cargoNombre,
        cargoNivel,
        tipoVacante,
        proyectoId,
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
        createdAt: schema.recruitmentNeeds.createdAt,
      });
    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: 'No se pudo crear la vacante' }, { status: 500 });
    }
    return NextResponse.json(row);
  } catch (e) {
    console.error('[recruitment/needs POST]', e);
    return NextResponse.json(
      { error: '¿Ejecutaste las migraciones 031–034 (recruitment_needs, cargo, proyecto_id)?' },
      { status: 500 },
    );
  }
}
