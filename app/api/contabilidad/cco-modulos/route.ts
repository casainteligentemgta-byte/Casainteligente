import { NextResponse } from 'next/server';
import { cargarCcoModulos } from '@/lib/contabilidad/cargarCcoModulos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

/** GET resumen vivo de pestañas CCO (ingresos, deudas, contratos, etc.). */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto')?.trim() || null;
    const data = await cargarCcoModulos(admin.client, { proyectoId });
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudieron cargar los módulos CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
