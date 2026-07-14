import { NextResponse } from 'next/server';
import {
  emparejarFotosConFacturas,
  mimeFromFotoFactura,
  MAX_FOTOS_POR_REQUEST,
  type FacturaCandidataEmpareje,
} from '@/lib/contabilidad/emparejarFotosFacturasGemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}

/**
 * POST /api/contabilidad/compras/emparejar-fotos
 * multipart: facturas (JSON) + files "foto" (repetido) + foto_ids (JSON array alineado)
 */
export async function POST(req: Request) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(
        'No se pudo leer el lote de fotos (límite de carga). Intente con menos archivos o más pequeños.',
        413,
      );
    }

    const facturasRaw = form.get('facturas');
    if (typeof facturasRaw !== 'string' || !facturasRaw.trim()) {
      return jsonError('Envíe facturas (JSON) del cuadro histórico.', 400);
    }

    let facturas: FacturaCandidataEmpareje[];
    try {
      const parsed = JSON.parse(facturasRaw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return jsonError('El listado de facturas está vacío.', 400);
      }
      facturas = parsed.map((row, idx) => {
        const r = row as Record<string, unknown>;
        return {
          key: String(r.key ?? `f-${idx}`),
          invoice_number: String(r.invoice_number ?? ''),
          supplier_name: String(r.supplier_name ?? ''),
          supplier_rif: String(r.supplier_rif ?? ''),
          fecha: String(r.fecha ?? '').slice(0, 10),
          total: Number(r.total) || 0,
          moneda: String(r.moneda ?? 'VES'),
          lineas: Number(r.lineas) || 0,
        };
      });
    } catch {
      return jsonError('JSON de facturas inválido.', 400);
    }

    let fotoIds: string[] = [];
    const idsRaw = form.get('foto_ids');
    if (typeof idsRaw === 'string' && idsRaw.trim()) {
      try {
        const parsed = JSON.parse(idsRaw) as unknown;
        if (Array.isArray(parsed)) fotoIds = parsed.map((x) => String(x));
      } catch {
        /* ignore */
      }
    }

    const files = form.getAll('foto').filter((x): x is File => x instanceof File);
    if (files.length === 0) {
      return jsonError('Envíe al menos un archivo en el campo foto.', 400);
    }
    if (files.length > MAX_FOTOS_POR_REQUEST) {
      return jsonError(
        `Máximo ${MAX_FOTOS_POR_REQUEST} fotos por intento. Empareje por lotes.`,
        400,
      );
    }

    const fotos = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (file.size > MAX_UPLOAD_BYTES) {
        return jsonError(
          `"${file.name}" supera 8 MB. Comprima la imagen o use otra foto.`,
          413,
        );
      }
      const mimeType = mimeFromFotoFactura(file);
      if (!mimeType) {
        return jsonError(`Formato no soportado: ${file.name}`, 400);
      }
      fotos.push({
        id: fotoIds[i] || `foto-${i}`,
        buffer: Buffer.from(await file.arrayBuffer()),
        mimeType,
        fileName: file.name,
      });
    }

    const { matches, modelHint } = await emparejarFotosConFacturas({
      facturas,
      fotos,
      concurrency: 2,
    });

    const emparejadas = matches.filter((m) => m.grupoKey).length;
    return NextResponse.json({
      ok: true,
      matches,
      emparejadas,
      total_fotos: matches.length,
      modelHint,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al emparejar fotos con facturas.';
    console.error('[POST /api/contabilidad/compras/emparejar-fotos]', error);
    let status = 500;
    if (message.includes('GEMINI_API_KEY')) status = 503;
    else if (message.includes('Cuota') || message.includes('429')) status = 429;
    return jsonError(message, status);
  }
}
