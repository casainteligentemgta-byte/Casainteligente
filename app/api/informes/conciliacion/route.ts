import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cargarInformeConciliacionCompras } from '@/lib/informes/cargarInformeConciliacionCompras';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 });
  }

  try {
    const data = await cargarInformeConciliacionCompras(supabase);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar la conciliación';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
