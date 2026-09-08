import { NextResponse } from 'next/server';
import { cargarManualFlota, eliminarManual } from '@/lib/flota/chatbot';
import { requireAccesoFlota } from '@/lib/flota/acceso';
import { esUuid } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const ct = req.headers.get('content-type') ?? '';
  try {
    if (ct.includes('application/json')) {
      const body = (await req.json()) as Record<string, unknown>;
      const texto = String(body.texto ?? '').trim();
      if (!texto) return NextResponse.json({ error: 'texto requerido' }, { status: 400 });
      const result = await cargarManualFlota(auth.supabase, {
        titulo: String(body.titulo ?? 'Manual pegado'),
        vehiculoMarca: String(body.vehiculo_marca ?? '') || null,
        vehiculoModelo: String(body.vehiculo_modelo ?? '') || null,
        fileName: 'manual.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(texto, 'utf8'),
        textoPegado: texto,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const form = await req.formData();
    const file = form.get('archivo');
    const textoPegado = String(form.get('texto') ?? '').trim();
    if (!(file instanceof File) && !textoPegado) {
      return NextResponse.json({ error: 'Adjunte un archivo o pegue el texto del manual' }, { status: 400 });
    }

    const buffer =
      file instanceof File ? Buffer.from(await file.arrayBuffer()) : Buffer.from(textoPegado, 'utf8');
    const result = await cargarManualFlota(auth.supabase, {
      titulo: String(form.get('titulo') ?? (file instanceof File ? file.name : 'Manual pegado')),
      vehiculoMarca: String(form.get('vehiculo_marca') ?? '') || null,
      vehiculoModelo: String(form.get('vehiculo_modelo') ?? '') || null,
      fileName: file instanceof File ? file.name : 'manual.txt',
      mimeType: file instanceof File ? file.type : 'text/plain',
      buffer,
      textoPegado: textoPegado || undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar el manual';
    return NextResponse.json({ error: msg }, { status: /requerid|suficiente/i.test(msg) ? 400 : 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const id = new URL(req.url).searchParams.get('id')?.trim() ?? '';
  if (!esUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  try {
    await eliminarManual(auth.supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al eliminar manual' },
      { status: 500 },
    );
  }
}
