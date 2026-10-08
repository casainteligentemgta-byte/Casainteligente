import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  SolicitudAnticipoPrestacionesPdf,
  type DatosSolicitudAnticipo,
} from '@/lib/nomina/SolicitudAnticipoPrestacionesPdf';
import { esFinalidadAnticipo } from '@/lib/nomina/finalidadAnticipo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** PDF del formulario de solicitud de anticipo de prestaciones (art. 144 LOTTT), para imprimir y firmar. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  let b: Partial<DatosSolicitudAnticipo>;
  try {
    b = (await req.json()) as Partial<DatosSolicitudAnticipo>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const datos: DatosSolicitudAnticipo = {
    empresa: String(b.empresa ?? ''),
    obra: String(b.obra ?? ''),
    trabajadorNombre: String(b.trabajadorNombre ?? ''),
    trabajadorCedula: String(b.trabajadorCedula ?? ''),
    fechaIso: String(b.fechaIso ?? new Date().toISOString().slice(0, 10)),
    garantiaCicloVes: Number(b.garantiaCicloVes) || 0,
    anticipoVes: Number(b.anticipoVes) || 0,
    tasaBcv: Number(b.tasaBcv) || 0,
    finalidad: esFinalidadAnticipo(b.finalidad) ? b.finalidad : null,
  };
  if (!datos.trabajadorNombre || datos.anticipoVes <= 0) {
    return NextResponse.json({ error: 'Faltan el trabajador o el monto del anticipo.' }, { status: 400 });
  }

  try {
    const node = createElement(SolicitudAnticipoPrestacionesPdf, { datos });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="solicitud-anticipo-prestaciones.pdf"',
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (e) {
    console.error('[solicitud anticipo pdf]', e);
    return NextResponse.json({ error: 'No se pudo generar el PDF.' }, { status: 500 });
  }
}
