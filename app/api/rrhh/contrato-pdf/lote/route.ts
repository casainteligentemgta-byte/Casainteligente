import { NextResponse } from 'next/server';
import { requirePermisoRrhhObra } from '@/lib/rrhh/requirePermisoRrhh';
import {
  generarPdfUnicoContratosExpress,
  MAX_CONTRATOS_PDF_LOTE,
} from '@/lib/rrhh/unirPdfsContratosExpress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST `{ express_ids: string[] }` — Une los PDF de contratos express en un solo archivo
 * para imprimir en lote (admin / obra).
 */
export async function POST(req: Request) {
  const gate = await requirePermisoRrhhObra();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const raw = (body as { express_ids?: unknown })?.express_ids;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { error: 'Indique express_ids (arreglo de ids).' },
      { status: 400 },
    );
  }

  const expressIds = raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);

  if (expressIds.length === 0) {
    return NextResponse.json(
      { error: 'Seleccione al menos un contrato.' },
      { status: 400 },
    );
  }
  if (expressIds.length > MAX_CONTRATOS_PDF_LOTE) {
    return NextResponse.json(
      { error: `Máximo ${MAX_CONTRATOS_PDF_LOTE} contratos por PDF único.` },
      { status: 400 },
    );
  }

  try {
    const out = await generarPdfUnicoContratosExpress(gate.supabase, expressIds);
    if (!out.ok) {
      return NextResponse.json({ error: out.error }, { status: 404 });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `contratos-obra-${stamp}-${out.incluidos}.pdf`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Contratos-Incluidos': String(out.incluidos),
    };
    if (out.omitidos.length > 0) {
      headers['X-Contratos-Omitidos'] = String(out.omitidos.length);
    }

    return new NextResponse(Buffer.from(out.pdf), {
      status: 200,
      headers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json(
        { error: 'Configuración Supabase incompleta en el servidor.' },
        { status: 503 },
      );
    }
    console.error('[contrato-pdf/lote]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
