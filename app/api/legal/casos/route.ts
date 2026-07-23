import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { siguienteCodigoExpedienteDesdeLista } from '@/lib/legal/codigoExpediente';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT_281 =
  'Ejecute la migración 281_ci_legal_expedientes_ramas_codigo.sql en Supabase SQL Editor.';

async function generarCodigoExpediente(
  admin: SupabaseClient,
  orgId: string,
): Promise<string> {
  const { data: rpcCodigo, error: rpcErr } = await admin.rpc(
    'ci_legal_siguiente_codigo_expediente',
    { p_org_id: orgId },
  );
  if (!rpcErr && typeof rpcCodigo === 'string' && rpcCodigo.trim()) {
    return rpcCodigo.trim();
  }

  const { data: existentes } = await admin
    .from('ci_legal_casos')
    .select('codigo')
    .eq('org_id', orgId)
    .not('codigo', 'is', null)
    .limit(500);

  return siguienteCodigoExpedienteDesdeLista(
    (existentes ?? []).map((r: { codigo?: string | null }) => r.codigo),
  );
}

/** GET — listado de expedientes / casos del org Legal. */
export async function GET(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const estado = url.searchParams.get('estado')?.trim() || null;
  const ambito = url.searchParams.get('ambito')?.trim() || null;
  const tipo = url.searchParams.get('tipo')?.trim() || null;

  let q = gate.admin
    .from('ci_legal_casos')
    .select('*')
    .eq('org_id', gate.acceso.orgId!)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (estado) q = q.eq('estado', estado);
  if (ambito) q = q.eq('ambito', ambito);
  if (tipo) q = q.eq('tipo', tipo);

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

  return NextResponse.json({ ok: true, casos: data ?? [], expedientes: data ?? [] });
}

/** POST — crear expediente (código EXP-YYYY-XXX automático). */
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

  const orgId = gate.acceso.orgId!;
  let codigo =
    body.codigo != null ? String(body.codigo).trim() || null : null;
  if (!codigo) {
    try {
      codigo = await generarCodigoExpediente(gate.admin, orgId);
    } catch (e) {
      return NextResponse.json(
        {
          error: e instanceof Error ? e.message : 'No se pudo generar código',
          hint: HINT_281,
        },
        { status: 500 },
      );
    }
  }

  const row = {
    org_id: orgId,
    titulo,
    tipo: String(body.tipo ?? 'otro').trim() || 'otro',
    ambito: String(body.ambito ?? 'externo').trim() || 'externo',
    estado: String(body.estado ?? 'abierto').trim() || 'abierto',
    prioridad: String(body.prioridad ?? 'media').trim() || 'media',
    resumen: body.resumen != null ? String(body.resumen).trim() || null : null,
    contraparte: body.contraparte != null ? String(body.contraparte).trim() || null : null,
    contraparte_rif:
      body.contraparte_rif != null ? String(body.contraparte_rif).trim() || null : null,
    cliente_nombre:
      body.cliente_nombre != null ? String(body.cliente_nombre).trim() || null : null,
    proyecto_id: body.proyecto_id ? String(body.proyecto_id) : null,
    entidad_id: body.entidad_id ? String(body.entidad_id) : null,
    fecha_limite: body.fecha_limite ? String(body.fecha_limite) : null,
    creado_por: gate.userId,
    asignado_a: gate.userId,
    codigo,
  };

  const { data, error } = await gate.admin.from('ci_legal_casos').insert(row).select('*').single();
  if (error) {
    // Colisión de código: reintentar una vez con correlativo fresco
    if (/unique|duplicate|idx_ci_legal_casos_org_codigo/i.test(error.message)) {
      const codigoRetry = await generarCodigoExpediente(gate.admin, orgId);
      const retry = await gate.admin
        .from('ci_legal_casos')
        .insert({ ...row, codigo: codigoRetry })
        .select('*')
        .single();
      if (!retry.error && retry.data) {
        return NextResponse.json({ ok: true, caso: retry.data, expediente: retry.data }, { status: 201 });
      }
      return NextResponse.json(
        { error: retry.error?.message || error.message, hint: HINT_281 },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: error.message, hint: HINT_281 }, { status: 500 });
  }

  return NextResponse.json({ ok: true, caso: data, expediente: data }, { status: 201 });
}
