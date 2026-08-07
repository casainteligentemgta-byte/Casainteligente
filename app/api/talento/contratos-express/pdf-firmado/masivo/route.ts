import { NextResponse } from 'next/server';
import { cedulaDigitosCore } from '@/lib/talento/cedulaAuth';
import {
  cedulaDigitosDesdeNombreArchivo,
  contratoCoincideConNombreArchivo,
} from '@/lib/talento/matchCedulaEnNombreArchivo';
import { subirPdfFirmadoContratoExpress } from '@/lib/talento/subirPdfFirmadoContratoExpress';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

const MAX_FILES = 80;

type ContratoMatch = {
  id: string;
  obrero_nombre: string;
  obrero_cedula: string;
};

type ResultadoMasivo =
  | {
      ok: true;
      archivo: string;
      contrato_id: string;
      obrero: string;
      cedula: string;
      pdf_firmado_storage_path: string;
    }
  | {
      ok: false;
      archivo: string;
      error: string;
      cedula_detectada?: string | null;
    };

/**
 * POST — Carga masiva de escaneos firmados.
 * FormData: `proyecto_id` + uno o más archivos en `files` (o `file` repetido).
 * Empareja cada archivo con el contrato express de la obra por cédula en el nombre.
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 });
  }

  const proyectoId = String(form.get('proyecto_id') ?? '').trim();
  if (!proyectoId) {
    return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 });
  }

  const files: File[] = [];
  for (const key of ['files', 'file']) {
    for (const entry of form.getAll(key)) {
      if (entry instanceof File && entry.size > 0) files.push(entry);
    }
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'Adjunte uno o más archivos PDF/imagen (campo «files»).' },
      { status: 400 },
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Máximo ${MAX_FILES} archivos por lote.` },
      { status: 400 },
    );
  }

  const { data: contratosRaw, error: cErr } = await admin.client
    .from('ci_contratos_express')
    .select('id,obrero_nombre,obrero_cedula')
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: false });

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const contratos = (contratosRaw ?? []) as ContratoMatch[];
  if (contratos.length === 0) {
    return NextResponse.json(
      { error: 'No hay contratos express en esta obra para emparejar.' },
      { status: 404 },
    );
  }

  const byDigits = new Map<string, ContratoMatch[]>();
  for (const c of contratos) {
    const dig = cedulaDigitosCore(c.obrero_cedula);
    if (dig.length < 6) continue;
    const list = byDigits.get(dig) ?? [];
    list.push(c);
    byDigits.set(dig, list);
  }

  const usados = new Set<string>();
  const resultados: ResultadoMasivo[] = [];
  let okCount = 0;

  for (const file of files) {
    const archivo = file.name || 'sin-nombre';
    const dig = cedulaDigitosDesdeNombreArchivo(archivo);
    if (!dig) {
      resultados.push({
        ok: false,
        archivo,
        error: 'No se detectó cédula en el nombre del archivo.',
        cedula_detectada: null,
      });
      continue;
    }

    const candidatos = (byDigits.get(dig) ?? []).filter((c) =>
      contratoCoincideConNombreArchivo(c.obrero_cedula, archivo),
    );

    if (candidatos.length === 0) {
      resultados.push({
        ok: false,
        archivo,
        error: 'Ningún contrato de la obra coincide con esa cédula.',
        cedula_detectada: dig,
      });
      continue;
    }

    // Preferir el más reciente aún no usado en este lote
    const pick = candidatos.find((c) => !usados.has(c.id)) ?? candidatos[0]!;
    if (usados.has(pick.id)) {
      resultados.push({
        ok: false,
        archivo,
        error: `El contrato de ${pick.obrero_nombre} ya recibió un archivo en este lote.`,
        cedula_detectada: dig,
      });
      continue;
    }

    const out = await subirPdfFirmadoContratoExpress(admin.client, pick.id, file, {
      filename: archivo,
    });
    if (!out.ok) {
      resultados.push({
        ok: false,
        archivo,
        error: out.error,
        cedula_detectada: dig,
      });
      continue;
    }

    usados.add(pick.id);
    okCount += 1;
    resultados.push({
      ok: true,
      archivo,
      contrato_id: pick.id,
      obrero: pick.obrero_nombre,
      cedula: pick.obrero_cedula,
      pdf_firmado_storage_path: out.pdf_firmado_storage_path,
    });
  }

  return NextResponse.json({
    ok: true,
    total: files.length,
    cargados: okCount,
    fallidos: files.length - okCount,
    resultados,
  });
}
