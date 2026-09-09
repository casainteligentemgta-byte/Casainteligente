import { NextResponse } from 'next/server';
import { requireAccesoFlota, subirArchivoFlota } from '@/lib/flota/acceso';
import { extraerFacturaGasolinaDesdeArchivo } from '@/lib/flota/extractFacturaGasolinaGemini';
import {
  MAX_BYTES_FACTURA_GASOLINA,
  mimeFacturaGasolina,
} from '@/lib/flota/extractFacturaGasolina';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function nombreSeguro(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return base || 'factura-gasolina.jpg';
}

export async function POST(req: Request) {
  try {
    const auth = await requireAccesoFlota();
    if (!auth.ok) return auth.response;
    let form: FormData;
    try {
      form = await req.formData();
    } catch (formErr) {
      console.error('[POST /api/flota/gasolina/ocr] formData', formErr);
      return NextResponse.json(
        { error: 'No se pudo leer el archivo. Pruebe una foto más liviana (máx. 10 MB).' },
        { status: 413 },
      );
    }
    const file = form.get('file') ?? form.get('archivo');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Envíe la foto o el PDF de la factura de gasolina.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES_FACTURA_GASOLINA) {
      return NextResponse.json(
        { error: 'La foto supera el límite de 10 MB. Use una imagen más liviana.' },
        { status: 413 },
      );
    }

    const mimeType = mimeFacturaGasolina(file);
    if (!mimeType) {
      return NextResponse.json(
        { error: 'Formato no soportado. Use foto JPG, PNG, WEBP, HEIC o un PDF.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { data, modelUsed } = await extraerFacturaGasolinaDesdeArchivo({
      buffer,
      mimeType,
      fileName: file.name,
    });

    let factura_url: string | null = null;
    try {
      factura_url = await subirArchivoFlota(auth.supabase, {
        path: `gasolina/${auth.userId}/${Date.now()}-${nombreSeguro(file.name)}`,
        buffer,
        contentType: mimeType,
      });
    } catch (uploadErr) {
      console.warn('[POST /api/flota/gasolina/ocr] storage', uploadErr);
    }

    return NextResponse.json({
      ok: true,
      ...data,
      factura_url,
      modelUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al leer la factura.';
    console.error('[POST /api/flota/gasolina/ocr]', error);
    let status = 500;
    if (message.includes('GEMINI_API_KEY') || message.includes('NEXT_PUBLIC_SUPABASE')) status = 503;
    else if (/Cuota|429/.test(message)) status = 429;
    else if (/no parece|No se pudieron leer|Envíe|Formato|10 MB/.test(message)) status = 400;
    return NextResponse.json({ error: message }, { status });
  }
}
