import { NextResponse } from 'next/server';
import {
  emparejarSoportesConEgresos,
  mimeFromSoporteFactura,
  MAX_SOPORTES_POR_REQUEST,
  type EgresoCandidatoSoporte,
} from '@/lib/contabilidad/cco/emparejarSoportesEgresos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Tope de archivos por request OCR (el cliente suele enviar 1 para evitar 413). */
const MAX_ARCHIVOS_OCR = 3;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}

/**
 * POST /api/contabilidad/cco/emparejar-soportes
 * multipart:
 *  - modo=ocr → solo OCR (recomendado; matching en el cliente contra el cuadro)
 *  - egresos (JSON, opcional si modo=ocr): candidatas sin documento
 *  - files "soporte" (repetido)
 *  - soporte_ids (JSON array alineado, opcional)
 *
 * PDF multipágina / varias facturas: parte por página (por_pagina=1 en OCR).
 * El cliente agrupa páginas de la misma factura y empareja en el navegador.
 * Con modo=ocr no envía los miles de egresos → evita HTTP 413 en Vercel.
 */
export async function POST(req: Request) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(
        'No se pudo leer el lote (límite de carga ~4,5 MB en Vercel). Suba un archivo a la vez o PDFs más livianos.',
        413,
      );
    }

    const modoRaw = form.get('modo');
    const soloOcr =
      (typeof modoRaw === 'string' && modoRaw.trim().toLowerCase() === 'ocr') ||
      form.get('solo_ocr') === '1' ||
      form.get('solo_ocr') === 'true';
    const porPagina =
      form.get('por_pagina') === '1' ||
      form.get('por_pagina') === 'true' ||
      (soloOcr && form.get('por_pagina') !== '0');

    const egresosRaw = form.get('egresos');
    let egresos: EgresoCandidatoSoporte[] = [];

    if (typeof egresosRaw === 'string' && egresosRaw.trim()) {
      try {
        const parsed = JSON.parse(egresosRaw) as unknown;
        if (Array.isArray(parsed)) {
          egresos = parsed.map((row, idx) => {
            const r = row as Record<string, unknown>;
            return {
              id: String(r.id ?? '').trim() || `e-${idx}`,
              proveedor: String(r.proveedor ?? '').trim(),
              fecha: r.fecha != null ? String(r.fecha).slice(0, 10) : null,
              moneda: String(r.moneda ?? 'USD').trim() || 'USD',
              monto_orig: Number(r.monto_orig) || 0,
              monto_base_usd: Number(r.monto_base_usd) || 0,
              tasa: Number(r.tasa) || 0,
              invoice_number:
                r.invoice_number != null ? String(r.invoice_number) : null,
              display_id: r.display_id as number | string | undefined,
            };
          });
        }
      } catch {
        return jsonError('JSON de egresos inválido.', 400);
      }
    }

    if (!soloOcr && egresos.length === 0) {
      return jsonError(
        'Envíe egresos (JSON) del cuadro CCO sin soporte, o use modo=ocr.',
        400,
      );
    }

    let soporteIds: string[] = [];
    const idsRaw = form.get('soporte_ids');
    if (typeof idsRaw === 'string' && idsRaw.trim()) {
      try {
        const parsed = JSON.parse(idsRaw) as unknown;
        if (Array.isArray(parsed)) soporteIds = parsed.map((x) => String(x));
      } catch {
        /* ignore */
      }
    }

    const files = form.getAll('soporte').filter((x): x is File => x instanceof File);
    if (files.length === 0) {
      return jsonError('Envíe al menos un archivo en el campo soporte.', 400);
    }
    const maxFiles = soloOcr ? MAX_ARCHIVOS_OCR : MAX_SOPORTES_POR_REQUEST;
    if (files.length > maxFiles) {
      return jsonError(
        `Máximo ${maxFiles} archivos por lote en este modo. Procese por lotes.`,
        400,
      );
    }

    const archivos = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (file.size > MAX_UPLOAD_BYTES) {
        return jsonError(
          `"${file.name}" supera 12 MB. Comprima o divida el lote.`,
          413,
        );
      }
      const mimeType = mimeFromSoporteFactura(file);
      if (!mimeType) {
        return jsonError(`Formato no soportado: ${file.name}`, 400);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      archivos.push({
        id: soporteIds[i] || `s-${i}-${file.name}`,
        buffer: buf,
        mimeType,
        fileName: file.name,
      });
    }

    const { matches, modelHint } = await emparejarSoportesConEgresos({
      egresos,
      archivos,
      concurrency: 2,
      soloOcr,
      porPagina,
    });

    return NextResponse.json({
      ok: true,
      matches,
      modelHint,
      soloOcr,
      porPagina,
      resumen: {
        auto: matches.filter((m) => m.decision === 'auto').length,
        duda: matches.filter((m) => m.decision === 'duda').length,
        sin_match: matches.filter((m) => m.decision === 'sin_match').length,
      },
    });
  } catch (e) {
    let message = e instanceof Error ? e.message : 'Error al emparejar soportes.';
    if (
      /did not match the expected pattern/i.test(message) ||
      /JSON Parse error/i.test(message) ||
      /is not valid JSON/i.test(message)
    ) {
      message =
        'No se pudo procesar el PDF (OCR o respuesta inválida). Pruebe con un PDF más corto o por facturas sueltas.';
    }
    console.error('[POST cco/emparejar-soportes]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
