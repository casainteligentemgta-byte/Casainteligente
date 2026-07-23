import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { emailEsDuenioLegal } from '@/lib/legal/accesoLegal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT =
  'Ejecute supabase/sql_editor_280_ci_legal_solicitudes.sql (migración 280).';

function assertOwner(gate: Awaited<ReturnType<typeof requireAccesoLegal>>) {
  if (!gate.ok) return gate.response;
  if (!emailEsDuenioLegal(gate.email) && gate.acceso.plan !== 'owner') {
    return NextResponse.json({ error: 'Solo el dueño CI puede gestionar solicitudes' }, { status: 403 });
  }
  return null;
}

/** GET — listar solicitudes (dueño CI). ?estado=pendiente */
export async function GET(req: Request) {
  const gate = await requireAccesoLegal();
  const deny = assertOwner(gate);
  if (deny) return deny;
  if (!gate.ok) return gate.response;

  const estado = new URL(req.url).searchParams.get('estado')?.trim() || null;
  let q = gate.admin
    .from('ci_legal_solicitudes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (estado) q = q.eq('estado', estado);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT }, { status: 500 });
  }
  return NextResponse.json({ ok: true, solicitudes: data ?? [] });
}
