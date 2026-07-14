import { NextResponse } from 'next/server';
import {
  extractTablaComprasHistoricasFromFile,
  mimeFromTablaFile,
} from '@/lib/contabilidad/extractTablaComprasHistoricasGemini';
import { validateProcurementDocument } from '@/lib/almacen/procurementDocumentStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/**
 * POST /api/contabilidad/compras/extract-tabla
 * Extrae filas de un PDF/imagen que contiene una TABLA de compras (no una factura).
 */
export async function POST(req: Request) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { error: 'No se pudo leer el archivo. Máx. 12 MB (PDF o imagen de la tabla).' },
        { status: 413 },
      );
    }

    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Envíe el PDF o imagen de la tabla de compras.' },
        { status: 400 },
      );
    }

    const sizeError = validateProcurementDocument(file);
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    const mimeType = mimeFromTablaFile(file);
    if (!mimeType) {
      return NextResponse.json(
        { error: 'Formato no soportado. Use PDF, JPG, PNG o WEBP.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { filas, modelUsed } = await extractTablaComprasHistoricasFromFile({
      buffer,
      mimeType,
      fileName: file.name,
    });

    return NextResponse.json({
      ok: true,
      filas,
      total_filas: filas.length,
      modelUsed,
    });
  } catch (error) {
    let message = error instanceof Error ? error.message : 'Error al leer la tabla.';
    if (/did not match the expected pattern/i.test(message) || /JSON Parse error/i.test(message)) {
      message =
        'No se pudo leer el documento con la IA. Exporte la tabla a CSV desde Excel y súbala, o use una captura PNG clara.';
    }
    console.error('[POST /api/contabilidad/compras/extract-tabla]', error);
    let status = 500;
    if (message.includes('GEMINI_API_KEY')) status = 503;
    else if (message.includes('Cuota') || message.includes('429')) status = 429;
    else if (message.includes('12 MB')) status = 413;
    else if (message.includes('No se detectaron')) status = 422;
    return NextResponse.json(
      { error: message },
      { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }
}
