import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { verificarVehiculo } from '@/lib/legal/complianceRules';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST — verificar traspaso vehículo (SAREN / INTT). */
export async function POST(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const fechaNotaria = String(body.fecha_notaria ?? '').trim();
  if (!fechaNotaria) {
    return NextResponse.json({ error: 'fecha_notaria requerida (AAAA-MM-DD)' }, { status: 400 });
  }

  try {
    const resultado = verificarVehiculo({
      fechaNotaria,
      titularCoincideIntt: Boolean(body.titular_coincide_intt),
    });
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Datos inválidos' },
      { status: 400 },
    );
  }
}
