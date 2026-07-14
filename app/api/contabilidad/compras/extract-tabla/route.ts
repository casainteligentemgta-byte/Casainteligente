import { NextResponse } from 'next/server';
import {
  extractTablaComprasHistoricasFromFile,
  mimeFromTablaFile,
} from '@/lib/contabilidad/extractTablaComprasHistoricasGemini';
import { validateProcurementDocument } from '@/lib/almacen/procurementDocumentStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/** Límite práctico en Vercel para multipart; archivos mayores suelen devolver HTML, no JSON. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}

/**
 * POST /api/contabilidad/compras/extract-tabla
 * Extrae filas de un PDF/imagen que contiene una TABLA de compras (no una factura).
 * Para tablas grandes prefiera CSV (parseo en el cliente, sin este endpoint).
 */
export async function POST(req: Request) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(
        'No se pudo leer el archivo (límite de carga). Use un CSV exportado desde Excel o un PDF menor a 4 MB.',
        413,
      );
    }

    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return jsonError('Envíe el PDF o imagen de la tabla de compras.', 400);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return jsonError(
        `El archivo pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB. Máximo 4 MB por PDF/imagen. Exporte la tabla a CSV desde Excel y súbala (recomendado).`,
        413,
      );
    }

    const sizeError = validateProcurementDocument(file);
    if (sizeError) {
      return jsonError(sizeError, 400);
    }

    const mimeType = mimeFromTablaFile(file);
    if (!mimeType) {
      return jsonError('Formato no soportado. Use PDF, JPG, PNG, WEBP o CSV.', 400);
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
        'La IA no pudo procesar el PDF. En Excel: Archivo → Guardar como → CSV UTF-8, y suba ese .csv aquí.';
    }
    console.error('[POST /api/contabilidad/compras/extract-tabla]', error);
    let status = 500;
    if (message.includes('GEMINI_API_KEY')) status = 503;
    else if (message.includes('Cuota') || message.includes('429')) status = 429;
    else if (message.includes('12 MB') || message.includes('4 MB')) status = 413;
    else if (message.includes('No se detectaron')) status = 422;
    return jsonError(message, status);
  }
}
