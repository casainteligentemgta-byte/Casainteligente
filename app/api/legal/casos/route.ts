import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — listado de casos del org Legal. */
export async function GET(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const estado = url.searchParams.get('estado')?.trim() || null;
  const ambito = url.searchParams.get('ambito')?.trim() || null;

  let q = gate.admin
    .from('ci_legal_casos')
    .select('*')
    .eq('org_id', gate.acceso.orgId!)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (estado) q = q.eq('estado', estado);
  if (ambito) q = q.eq('ambito', ambito);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: 'Ejecute la migración 266_ci_departamento_legal.sql en Supabase SQL Editor.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, casos: data ?? [] });
}

/** POST — crear caso. */
export async function POST(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const titulo = String(body.titulo ?? '').trim();
  if (!titulo) {
    return NextResponse.json({ error: 'titulo requerido' }, { status: 400 });
  }

  const row = {
    org_id: gate.acceso.orgId!,
    titulo,
    tipo: String(body.tipo ?? 'otro').trim() || 'otro',
    ambito: String(body.ambito ?? 'externo').trim() || 'externo',
    estado: String(body.estado ?? 'abierto').trim() || 'abierto',
    prioridad: String(body.prioridad ?? 'media').trim() || 'media',
    resumen: body.resumen != null ? String(body.resumen).trim() || null : null,
    contraparte: body.contraparte != null ? String(body.contraparte).trim() || null : null,
    contraparte_rif: body.contraparte_rif != null ? String(body.contraparte_rif).trim() || null : null,
    cliente_nombre: body.cliente_nombre != null ? String(body.cliente_nombre).trim() || null : null,
    proyecto_id: body.proyecto_id ? String(body.proyecto_id) : null,
    entidad_id: body.entidad_id ? String(body.entidad_id) : null,
    fecha_limite: body.fecha_limite ? String(body.fecha_limite) : null,
    creado_por: gate.userId,
    asignado_a: gate.userId,
    codigo: body.codigo != null ? String(body.codigo).trim() || null : null,
  };

  const { data, error } = await gate.admin.from('ci_legal_casos').insert(row).select('*').single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, caso: data }, { status: 201 });
}
