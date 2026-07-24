import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import { validarTasaTimbreLocaptem } from '@/lib/legal/locaptemValidator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST — validar tasa registral/municipal (LOCAPTEM). */
export async function POST(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const esPersonaJuridica = Boolean(body.es_persona_juridica);
  const montoCobradoBs = Number(body.monto_cobrado_bs);
  const tcmmvBcv = Number(body.tcmmv_bcv);

  try {
    const resultado = validarTasaTimbreLocaptem({
      esPersonaJuridica,
      montoCobradoBs,
      tcmmvBcv,
    });
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Datos inválidos' },
      { status: 400 },
    );
  }
}
