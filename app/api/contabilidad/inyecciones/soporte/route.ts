import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extraerSerialesBilletesGemini } from '@/lib/contabilidad/extraerSerialesBilletesGemini';
import { uploadSoporteInyeccionCapital } from '@/lib/contabilidad/uploadSoporteInyeccionCapital';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';

export async function POST(req: Request) {
  const form = await req.formData();
  const proyectoId = String(form.get('proyecto_id') ?? '').trim();
  const metodoPago = String(form.get('metodo_pago') ?? 'TRANSFERENCIA');
  const file = form.get('archivo');

  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: 'Obra inválida para subir soporte.' }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Seleccione un archivo de soporte.' }, { status: 400 });
  }

  const supabase = await createClient();

  let path: string;
  let mimeType: string;
  try {
    const up = await uploadSoporteInyeccionCapital(supabase, proyectoId, file);
    path = up.path;
    mimeType = up.mimeType;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo subir el archivo.' },
      { status: 400 },
    );
  }

  const { data: signed } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .createSignedUrl(path, 3600);

  let seriales: string[] = [];
  if (metodoPago === 'EFECTIVO' && mimeType.startsWith('image/')) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      seriales = await extraerSerialesBilletesGemini({
        mimeType,
        base64: buf.toString('base64'),
      });
    } catch (e) {
      console.warn('[inyecciones/soporte OCR]', e);
    }
  }

  return NextResponse.json({
    ok: true,
    soporte_storage_path: path,
    soporte_url: signed?.signedUrl ?? null,
    seriales_billetes: seriales,
  });
}
