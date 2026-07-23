import { NextResponse } from 'next/server';
import { importCsvToRegistrosGastos } from '@/lib/contabilidad/cco/importCsvToRegistrosGastos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/contabilidad/cco/gastos/import
 * Body JSON: { csvText } o multipart file.
 * Siempre reemplazo limpio (CSV diario acumulado → sin duplicar).
 */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const contentType = req.headers.get('content-type') ?? '';
    let csvText = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (file instanceof File) {
        csvText = await file.text();
      } else if (typeof form.get('csvText') === 'string') {
        csvText = String(form.get('csvText'));
      }
    } else {
      const body = (await req.json()) as { csvText?: string };
      csvText = String(body.csvText ?? '');
    }

    if (!csvText.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Falta el contenido CSV (csvText o file).' },
        { status: 400 },
      );
    }

    const result = await importCsvToRegistrosGastos(admin.client, csvText);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al importar CSV.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
