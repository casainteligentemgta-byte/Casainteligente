import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { buscarCausasTsj } from '@/lib/legal/tsjSearch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — búsqueda automatizada de causas TSJ (Google CSE). */
export async function GET(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() || '';
  if (!q) {
    return NextResponse.json({ error: 'Parámetro q requerido' }, { status: 400 });
  }

  try {
    const result = await buscarCausasTsj({ criterio: q });
    return NextResponse.json({
      ok: true,
      items: result.items,
      simulated: result.simulated,
      query: result.query,
      total: result.items.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error en búsqueda TSJ' },
      { status: 502 },
    );
  }
}
