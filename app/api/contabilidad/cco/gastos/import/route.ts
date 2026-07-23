import { NextResponse } from 'next/server';
import { importCsvToRegistrosGastos } from '@/lib/contabilidad/cco/importCsvToRegistrosGastos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/contabilidad/cco/gastos/import
 * Body JSON: { csvText, proyectoId } o multipart file + proyectoId.
 * Reemplazo limpio por obra (CSV diario acumulado → sin duplicar).
 */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const contentType = req.headers.get('content-type') ?? '';
    let csvText = '';
    let proyectoId = '';
    let csvFileName = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (file instanceof File) {
        csvText = await file.text();
        csvFileName = file.name || '';
      } else if (typeof form.get('csvText') === 'string') {
        csvText = String(form.get('csvText'));
      }
      proyectoId = String(form.get('proyectoId') ?? form.get('proyecto_id') ?? '').trim();
      if (!csvFileName) {
        csvFileName = String(form.get('fileName') ?? form.get('csvFileName') ?? '').trim();
      }
    } else {
      const body = (await req.json()) as {
        csvText?: string;
        proyectoId?: string;
        proyecto_id?: string;
        fileName?: string;
        csvFileName?: string;
      };
      csvText = String(body.csvText ?? '');
      proyectoId = String(body.proyectoId ?? body.proyecto_id ?? '').trim();
      csvFileName = String(body.fileName ?? body.csvFileName ?? '').trim();
    }

    if (!proyectoId) {
      return NextResponse.json(
        { ok: false, error: 'Falta proyectoId (obra). Selecciónala en el dashboard antes de importar.' },
        { status: 400 },
      );
    }

    if (!csvText.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Falta el contenido CSV (csvText o file).' },
        { status: 400 },
      );
    }

    const result = await importCsvToRegistrosGastos(admin.client, csvText, {
      proyectoId,
      csvFileName: csvFileName || null,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al importar CSV.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
