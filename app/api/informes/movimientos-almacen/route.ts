import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cargarInformeMovimientosAlmacen } from '@/lib/informes/resumirMovimientosAlmacen';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  const dias = Number(req.nextUrl.searchParams.get('dias') ?? '7');

  try {
    const data = await cargarInformeMovimientosAlmacen(supabase, { dias });
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar movimientos de almacén';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
