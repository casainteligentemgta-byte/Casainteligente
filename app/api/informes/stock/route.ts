import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cargarInformeStock } from '@/lib/informes/cargarInformeStock';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')?.trim() || null;

  try {
    const data = await cargarInformeStock(supabase, { proyectoId });
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar stock valorizado';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
