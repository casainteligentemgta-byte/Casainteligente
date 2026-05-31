import { NextResponse } from 'next/server';
import {
  registrarDespachoWeb,
  type LineaDespachoWebInput,
  type RegistrarDespachoWebInput,
} from '@/lib/almacen/registrarDespachoWeb';
import { uploadDespachoFoto } from '@/lib/almacen/uploadDespachoFoto';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** POST /api/almacen/despacho — multipart: payload (JSON) + fotos opcionales. */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let body: Omit<RegistrarDespachoWebInput, 'fotos'>;
    const fotoFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const raw = form.get('payload');
      if (typeof raw !== 'string') {
        return NextResponse.json({ error: 'Falta campo payload JSON.' }, { status: 400 });
      }
      body = JSON.parse(raw) as Omit<RegistrarDespachoWebInput, 'fotos'>;
      for (const [key, val] of Array.from(form.entries())) {
        if (key.startsWith('foto') && val instanceof File && val.size > 0) {
          fotoFiles.push(val);
        }
      }
    } else {
      body = (await req.json()) as Omit<RegistrarDespachoWebInput, 'fotos'>;
    }

    if (!body.proyectoId?.trim()) {
      return NextResponse.json({ error: 'proyectoId requerido' }, { status: 400 });
    }
    if (!body.obreroNombre?.trim()) {
      return NextResponse.json({ error: 'Indique el obrero receptor.' }, { status: 400 });
    }
    if (!Array.isArray(body.lineas) || body.lineas.length === 0) {
      return NextResponse.json({ error: 'Agregue al menos una línea.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const fotos = [];
    for (let i = 0; i < fotoFiles.length; i++) {
      fotos.push(await uploadDespachoFoto(supabase, body.proyectoId, fotoFiles[i]!, i));
    }

    const result = await registrarDespachoWeb(supabase, {
      ...body,
      lineas: body.lineas as LineaDespachoWebInput[],
      fotos,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      egresoId: result.egresoId,
      codigos: result.codigos,
      transferenciaIds: result.transferenciaIds,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al registrar despacho';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
