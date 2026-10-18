import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cargarInformeCompras } from '@/lib/informes/cargarInformeCompras';
import type { PeriodoComprasTelegram } from '@/lib/contabilidad/cargarComprasPeriodoTelegram';
import { todayIsoVenezuela } from '@/lib/contabilidad/comprasFiltros';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  const periodoRaw = (req.nextUrl.searchParams.get('periodo') || 'mes').toLowerCase();
  const periodo: PeriodoComprasTelegram =
    periodoRaw === 'dia' || periodoRaw === 'semana' || periodoRaw === 'mes' ? periodoRaw : 'mes';
  const ref = req.nextUrl.searchParams.get('ref')?.trim() || todayIsoVenezuela();

  try {
    const data = await cargarInformeCompras(supabase, periodo, ref);
    return NextResponse.json({ ok: true, periodo, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar informe de compras';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
