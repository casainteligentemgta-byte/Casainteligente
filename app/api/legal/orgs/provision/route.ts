import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import {
  emailEsDuenioLegal,
  esPlanLegalStandalone,
  type LegalPlan,
} from '@/lib/legal/accesoLegal';
import { buscarUsuarioIdPorEmail } from '@/lib/auth/buscarUsuarioIdPorEmail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/legal/orgs/provision
 * Solo dueño Casa Inteligente: crea org Legal standalone + asiento para un email.
 * Body: { nombre, email, plan?: trial|solo|equipo|estudio, valido_hasta?, user_id? }
 */
export async function POST(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  if (!emailEsDuenioLegal(gate.email) && gate.acceso.plan !== 'owner') {
    return NextResponse.json(
      { error: 'Solo el dueño de Casa Inteligente puede provisionar orgs de terceros.' },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const nombre = String(body.nombre ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!nombre || !email) {
    return NextResponse.json({ error: 'nombre y email requeridos' }, { status: 400 });
  }

  const planRaw = String(body.plan ?? 'trial').trim() || 'trial';
  if (!esPlanLegalStandalone(planRaw)) {
    return NextResponse.json(
      { error: 'plan debe ser trial, solo, equipo o estudio (standalone)' },
      { status: 400 },
    );
  }
  const plan = planRaw as Exclude<LegalPlan, 'owner'>;
  const validoHasta = body.valido_hasta ? String(body.valido_hasta) : null;
  let userId = body.user_id ? String(body.user_id).trim() : '';

  if (!userId) {
    const found = await buscarUsuarioIdPorEmail(gate.admin, email);
    if ('userId' in found) userId = found.userId;
  }

  if (!userId) {
    return NextResponse.json(
      {
        error:
          'No se encontró usuario Auth con ese email. Créalo en Supabase Auth o envía user_id.',
        hint: 'Auth → Invite user, luego vuelve a provisionar con el mismo email.',
      },
      { status: 404 },
    );
  }

  const { data: org, error: orgErr } = await gate.admin
    .from('ci_legal_orgs')
    .insert({
      nombre,
      plan,
      status: 'active',
      valido_hasta: validoHasta,
    })
    .select('*')
    .single();

  if (orgErr || !org) {
    return NextResponse.json(
      { error: orgErr?.message || 'No se pudo crear la org', hint: 'Migración 266' },
      { status: 500 },
    );
  }

  const { data: seat, error: seatErr } = await gate.admin
    .from('ci_legal_entitlements')
    .insert({
      org_id: org.id,
      user_id: userId,
      email,
      rol_legal: 'admin',
      activo: true,
    })
    .select('*')
    .single();

  if (seatErr) {
    return NextResponse.json(
      {
        error: seatErr.message,
        org,
        hint: 'Org creada pero falló el asiento; revise unique (org,user).',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    org,
    entitlement: seat,
    modo_producto: 'standalone',
    mensaje: `${email} ya puede entrar a /legal como módulo abogado (plan ${plan}).`,
  });
}
