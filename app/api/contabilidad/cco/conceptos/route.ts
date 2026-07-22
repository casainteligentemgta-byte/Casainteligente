import { NextResponse } from 'next/server';
import { cargarConceptosMateriales } from '@/lib/contabilidad/cco/cargarConceptosMateriales';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const proyectoId = new URL(req.url).searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const data = await cargarConceptosMateriales(admin.client, proyectoId);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Error al cargar conceptos de materiales.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
