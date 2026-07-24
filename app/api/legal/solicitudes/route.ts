import { NextResponse } from 'next/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { esPlanLegalStandalone } from '@/lib/legal/accesoLegal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT =
  'Ejecute supabase/sql_editor_280_ci_legal_solicitudes.sql (migración 280) en Supabase.';

/**
 * POST público — solicitud de acceso al Módulo Abogado.
 * Body: nombre_despacho, contacto_nombre, email, plan_solicitado?, telefono?, mensaje?
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const nombreDespacho = String(body.nombre_despacho ?? '').trim();
  const contactoNombre = String(body.contacto_nombre ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const telefono = String(body.telefono ?? '').trim() || null;
  const mensaje = String(body.mensaje ?? '').trim() || null;
  const plan = String(body.plan_solicitado ?? 'trial').trim() || 'trial';

  if (!nombreDespacho || !contactoNombre || !email.includes('@')) {
    return NextResponse.json(
      { error: 'nombre_despacho, contacto_nombre y email válidos son requeridos' },
      { status: 400 },
    );
  }
  if (!esPlanLegalStandalone(plan)) {
    return NextResponse.json({ error: 'plan_solicitado inválido' }, { status: 400 });
  }

  const admin = createSupabaseAdminOnlyClient();
  if (!admin) {
    return NextResponse.json({ error: 'Admin Supabase no configurado' }, { status: 500 });
  }

  const { data: prev } = await admin
    .from('ci_legal_solicitudes')
    .select('id, estado')
    .ilike('email', email)
    .eq('estado', 'pendiente')
    .limit(1)
    .maybeSingle();

  if (prev) {
    return NextResponse.json({
      ok: true,
      duplicado: true,
      solicitud_id: prev.id,
      mensaje: 'Ya tienes una solicitud pendiente con este correo.',
    });
  }

  const { data, error } = await admin
    .from('ci_legal_solicitudes')
    .insert({
      nombre_despacho: nombreDespacho,
      contacto_nombre: contactoNombre,
      email,
      telefono,
      plan_solicitado: plan,
      mensaje,
      estado: 'pendiente',
    })
    .select('id, email, plan_solicitado, estado, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, hint: HINT }, { status: 500 });
  }

  return NextResponse.json({ ok: true, solicitud: data }, { status: 201 });
}
