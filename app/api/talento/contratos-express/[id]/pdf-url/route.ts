import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolverContratoPdfExpress } from '@/lib/rrhh/resolverContratoPdfServer';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/** GET — URL firmada temporal (`expires_sec`). `?doc=firmado` usa el archivo subido tras firma del obrero. */
export async function GET(req: Request, context: { params: { id: string } }) {
  const id = (context.params?.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const url = new URL(req.url);
  const wantFirmado = url.searchParams.get('doc')?.toLowerCase() === 'firmado';

  let client: SupabaseClient;
  try {
    client = await createClient();
  } catch {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    client = admin.client;
  }

  const out = await resolverContratoPdfExpress(client, id, { preferFirmado: wantFirmado });
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  if (out.source === 'generate') {
    return NextResponse.json(
      { error: 'Sin PDF en almacenamiento. Regenerelo desde Talento o RRHH.' },
      { status: 404 },
    );
  }

  if (!out.signedUrl) {
    return NextResponse.json(
      {
        error:
          'El PDF está registrado pero no se pudo firmar la URL. Use el visor desde el módulo del proyecto (icono PDF).',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: out.signedUrl,
    expires_sec: out.expires_sec,
    doc: wantFirmado ? 'firmado' : 'generado',
  });
}
