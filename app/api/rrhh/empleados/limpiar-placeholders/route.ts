import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { limpiarPlaceholdersHv } from '@/lib/rrhh/limpiarPlaceholdersHv';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST — Elimina expedientes «Por completar» / pendiente_cv sin cédula
 * (invitaciones HV no usadas).
 */
export async function POST() {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  const admin = supabaseAdminForRoute();
  const supabase = admin.ok ? admin.client : supabaseAuth;

  try {
    const result = await limpiarPlaceholdersHv(supabase);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo limpiar';
    console.error('[limpiar-placeholders]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
