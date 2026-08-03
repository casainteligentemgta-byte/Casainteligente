import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { importarFacturaArchivoYVincularProcuras } from '@/lib/procuras/importarFacturaArchivoProcura';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function parseProcuraIds(raw: FormDataEntryValue | null): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((id) => String(id).trim()).filter(Boolean);
    }
  } catch {
    /* csv */
  }
  return s
    .split(/[,;\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function parseNum(raw: FormDataEntryValue | null): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseExtracted(raw: FormDataEntryValue | null): ExtractedPurchaseInvoice | null {
  if (raw == null || String(raw).trim() === '') return null;
  try {
    const parsed = JSON.parse(String(raw)) as ExtractedPurchaseInvoice;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * POST /api/compras/procuras/importar-factura
 * Multipart: file + procura_ids (+ overrides opcionales / extracted JSON).
 * Crea factura en contabilidad y vincula las procuras aprobadas.
 */
export async function POST(req: Request) {
  let auth = await requirePermisoWeb('procura.ejecutar_compra');
  if (!auth.ok) auth = await requirePermisoWeb('procura.aprobar');
  if (!auth.ok) return auth.response;

  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            'No se pudo leer el archivo. Pruebe un PDF más pequeño (máx. 12 MB) o una imagen JPG/PNG.',
        },
        { status: 413 },
      );
    }

    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Debe enviar un archivo PDF o imagen.' }, { status: 400 });
    }

    const procuraIds = parseProcuraIds(form.get('procura_ids'));
    if (!procuraIds.length) {
      return NextResponse.json({ error: 'Indique procura_ids.' }, { status: 400 });
    }

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const result = await importarFacturaArchivoYVincularProcuras(admin.client, {
      file,
      procuraIds,
      extracted: parseExtracted(form.get('extracted')),
      overrides: {
        invoice_number: form.get('invoice_number')
          ? String(form.get('invoice_number'))
          : null,
        supplier_name: form.get('supplier_name') ? String(form.get('supplier_name')) : null,
        supplier_rif: form.get('supplier_rif') ? String(form.get('supplier_rif')) : null,
        fecha: form.get('fecha') ? String(form.get('fecha')) : null,
        total_amount: parseNum(form.get('total_amount')),
        tasa_bcv: parseNum(form.get('tasa_bcv')),
      },
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo importar la factura.';
    console.error('[POST /api/compras/procuras/importar-factura]', err);
    let status = 500;
    if (/Indique|estado|vinculada|obra|número de factura|tasa BCV|Formato|12 MB/i.test(message)) {
      status = 400;
    } else if (/GEMINI_API_KEY/i.test(message)) status = 503;
    else if (/Cuota|429/i.test(message)) status = 429;
    return NextResponse.json({ error: message }, { status });
  }
}
