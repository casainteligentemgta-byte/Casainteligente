import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';

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
        createdAt: schema.recruitmentNeeds.createdAt,
      })
      .from(schema.recruitmentNeeds)
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
  let body: { title?: string; notes?: string | null };
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
  try {
    const inserted = await db
      .insert(schema.recruitmentNeeds)
      .values({ title, notes, protocolActive: true })
      .returning({
        id: schema.recruitmentNeeds.id,
        title: schema.recruitmentNeeds.title,
        notes: schema.recruitmentNeeds.notes,
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
      { error: '¿Ejecutaste la migración 031_recruitment_needs.sql?' },
      { status: 500 },
    );
  }
}
