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

const HINT =
  'Ejecute migraciones 266 y 280 (orgs + solicitudes) en Supabase.';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

function baseUrlApp(req: Request): string {
  const env =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    '';
  if (env) return env.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return 'https://casainteligente.company';
}

/**
 * POST /api/legal/solicitudes/[id]/aprobar
 * Dueño CI: invita Auth + crea org standalone + entitlement + marca solicitud aprobada.
 * Body opcional: { plan?, valido_hasta?, dias_trial? }
 */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;
  if (!emailEsDuenioLegal(gate.email) && gate.acceso.plan !== 'owner') {
    return NextResponse.json({ error: 'Solo el dueño CI puede aprobar' }, { status: 403 });
  }

  const { id } = await Promise.resolve(ctx.params);
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* vacío ok */
  }

  const { data: sol, error: getErr } = await gate.admin
    .from('ci_legal_solicitudes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (getErr) {
    return NextResponse.json({ error: getErr.message, hint: HINT }, { status: 500 });
  }
  if (!sol) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  }
  if (sol.estado !== 'pendiente') {
    return NextResponse.json(
      { error: `La solicitud ya está ${sol.estado}` },
      { status: 409 },
    );
  }

  const planRaw = String(body.plan ?? sol.plan_solicitado ?? 'trial').trim();
  if (!esPlanLegalStandalone(planRaw)) {
    return NextResponse.json({ error: 'plan inválido' }, { status: 400 });
  }
  const plan = planRaw as Exclude<LegalPlan, 'owner'>;

  let validoHasta: string | null = body.valido_hasta
    ? String(body.valido_hasta)
    : null;
  if (!validoHasta && plan === 'trial') {
    const dias = Number(body.dias_trial ?? 14) || 14;
    const d = new Date();
    d.setDate(d.getDate() + dias);
    validoHasta = d.toISOString();
  }

  const email = String(sol.email).trim().toLowerCase();
  let userId = '';
  const found = await buscarUsuarioIdPorEmail(gate.admin, email);
  if ('userId' in found) {
    userId = found.userId;
  } else {
    const { data: invited, error: invErr } =
      await gate.admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${baseUrlApp(req)}/legal`,
        data: {
          nombre: sol.contacto_nombre,
          legal_standalone: true,
          despacho: sol.nombre_despacho,
        },
      });
    if (invErr || !invited?.user?.id) {
      return NextResponse.json(
        {
          error: invErr?.message || 'No se pudo invitar al usuario por correo',
          hint: 'Revisa SMTP/Auth de Supabase o crea el usuario manualmente.',
        },
        { status: 500 },
      );
    }
    userId = invited.user.id;
  }

  const { data: org, error: orgErr } = await gate.admin
    .from('ci_legal_orgs')
    .insert({
      nombre: sol.nombre_despacho,
      plan,
      status: 'active',
      valido_hasta: validoHasta,
    })
    .select('*')
    .single();

  if (orgErr || !org) {
    return NextResponse.json(
      { error: orgErr?.message || 'No se pudo crear la org', hint: HINT },
      { status: 500 },
    );
  }

  const { error: seatErr } = await gate.admin.from('ci_legal_entitlements').upsert(
    {
      org_id: org.id,
      user_id: userId,
      email,
      rol_legal: 'admin',
      activo: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,user_id' },
  );

  if (seatErr) {
    return NextResponse.json(
      { error: seatErr.message, org, hint: HINT },
      { status: 500 },
    );
  }

  const { data: updated, error: upErr } = await gate.admin
    .from('ci_legal_solicitudes')
    .update({
      estado: 'aprobada',
      org_id: org.id,
      revisado_por: gate.userId,
      revisado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      plan_solicitado: plan,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (upErr) {
    return NextResponse.json({ error: upErr.message, org }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    solicitud: updated,
    org,
    mensaje: `${email} aprobado. Plan ${plan}. Entrar en /legal (standalone).`,
  });
}
