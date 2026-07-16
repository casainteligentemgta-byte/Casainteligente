import { NextResponse } from 'next/server';
import { buildContratoLaboralPlantillaPdfBuffer } from '@/lib/talento/contratoLaboralPlantillaPdfBuffer';
import { persistLaboralPlantillaPdfIfMissing } from '@/lib/talento/contratoLaboralRegistroStorage';
import { contratoObreroPorToken } from '@/lib/talento/contratoObreroToken';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET ?contrato_id=&token= — PDF del contrato laboral (plantilla biblioteca + datos expediente / hoja de empleo).
 * Archiva una copia en Storage (`contratos_obreros`) la primera vez que se genera correctamente.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contratoId = (searchParams.get('contrato_id') ?? '').trim();
  const token = (searchParams.get('token') ?? '').trim();
  if (!contratoId || !token) {
    return NextResponse.json({ error: 'contrato_id y token requeridos' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const v = await contratoObreroPorToken(admin.client, contratoId, token);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  const built = await buildContratoLaboralPlantillaPdfBuffer(admin.client, contratoId);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const persist = await persistLaboralPlantillaPdfIfMissing(admin.client, contratoId, built.buffer);
  if ('error' in persist) {
    console.warn('[contrato-laboral pdf] no se pudo archivar en Storage:', persist.error);
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contrato-laboral-${contratoId.slice(0, 8)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
