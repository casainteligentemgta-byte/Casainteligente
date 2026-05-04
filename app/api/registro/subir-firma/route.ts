import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

function normDoc(s: string) {
  return s.replace(/\s+/g, '').toUpperCase();
}

type Body = {
  empleadoId?: string;
  dataUrl?: string;
  eventId?: string;
  capturedAtIso?: string;
  cedula?: string;
};

/**
 * Sube PNG al bucket talento-firmas y actualiza ci_empleados (trazabilidad).
 * Valida que la cédula coincida con el empleado (postulación pública).
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const empleadoId = (body.empleadoId ?? '').trim();
  const dataUrl = (body.dataUrl ?? '').trim();
  const eventId = (body.eventId ?? '').trim();
  const capturedAtIso = (body.capturedAtIso ?? '').trim();
  const cedula = (body.cedula ?? '').trim();

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!empleadoId || !dataUrl || !eventId || !capturedAtIso || !cedula) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }
  if (!uuidRe.test(empleadoId) || !uuidRe.test(eventId)) {
    return NextResponse.json({ error: 'Identificadores inválidos' }, { status: 400 });
  }

  const m = /^data:image\/png;base64,(.+)$/i.exec(dataUrl);
  if (!m) {
    return NextResponse.json({ error: 'dataUrl debe ser PNG en base64' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: row, error: selErr } = await admin.client
    .from('ci_empleados')
    .select('id, documento, cedula')
    .eq('id', empleadoId)
    .maybeSingle();

  if (selErr) {
    console.error('[subir-firma]', selErr);
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  const r = row as { id: string; documento?: string | null; cedula?: string | null };
  const dbDoc = normDoc(String(r.documento ?? r.cedula ?? ''));
  if (!dbDoc || dbDoc !== normDoc(cedula)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(m[1], 'base64');
  } catch {
    return NextResponse.json({ error: 'Base64 inválido' }, { status: 400 });
  }
  if (buffer.length < 80 || buffer.length > 4_000_000) {
    return NextResponse.json({ error: 'Tamaño de imagen no permitido' }, { status: 400 });
  }

  const path = `${empleadoId}/firma.png`;
  const { error: upErr } = await admin.client.storage.from('talento-firmas').upload(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  });
  if (upErr) {
    console.error('[subir-firma] storage', upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: pub } = admin.client.storage.from('talento-firmas').getPublicUrl(path);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) {
    return NextResponse.json({ error: 'No se obtuvo URL pública de la firma' }, { status: 500 });
  }

  const { error: upEmp } = await admin.client
    .from('ci_empleados')
    .update({
      firma_electronica_url: publicUrl,
      firma_electronica_id: eventId,
      firma_electronica_at: capturedAtIso,
    } as never)
    .eq('id', empleadoId);

  if (upEmp) {
    console.error('[subir-firma] update', upEmp);
    return NextResponse.json({ error: upEmp.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, publicUrl, eventId });
}
