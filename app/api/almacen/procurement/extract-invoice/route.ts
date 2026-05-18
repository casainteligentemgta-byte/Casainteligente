import { NextResponse } from 'next/server';
import {
  extractPurchaseInvoiceFromFile,
  mimeFromFile,
} from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { validateProcurementDocument } from '@/lib/almacen/procurementDocumentStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch (formErr) {
      console.error('[extract-invoice] formData', formErr);
      return NextResponse.json(
        {
          error:
            'No se pudo leer el archivo enviado. Pruebe un PDF más pequeño (máx. 12 MB) o una imagen JPG/PNG.',
        },
        { status: 413 }
      );
    }

    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Debe enviar un archivo PDF o imagen.' }, { status: 400 });
    }

    const sizeError = validateProcurementDocument(file);
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    const mimeType = mimeFromFile(file);
    if (!mimeType) {
      return NextResponse.json(
        { error: 'Formato no soportado. Use PDF, JPG, PNG o WEBP.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { data, fromGemini, modelUsed } = await extractPurchaseInvoiceFromFile({
      buffer,
      mimeType,
      fileName: file.name,
    });

    return NextResponse.json({ ...data, fromGemini, modelUsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al extraer la factura.';
    console.error('[POST /api/almacen/procurement/extract-invoice]', error);
    let status = 500;
    if (message.includes('GEMINI_API_KEY')) status = 503;
    else if (message.includes('Cuota') || message.includes('429')) status = 429;
    else if (message.includes('12 MB')) status = 413;
    return NextResponse.json({ error: message }, { status });
  }
}
