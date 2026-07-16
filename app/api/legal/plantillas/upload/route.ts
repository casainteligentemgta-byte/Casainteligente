import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import {
  buildPlantillaStoragePath,
  esTipoDocumentoLegal,
  extraerVariablesDeCuerpo,
  LEGAL_PLANTILLAS_BUCKET,
  leerTextoArchivoFormato,
  slugCodigoPlantilla,
  validarArchivoFormato,
} from '@/lib/legal/plantillasFormatos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT =
  'Ejecute las migraciones 271 y 273 (plantillas + bucket legal-plantillas) en Supabase.';

/**
 * POST multipart/form-data
 * Campos: file (requerido), titulo?, tipo?, codigo?, descripcion?, categoria?, jurisdiccion?, cuerpo_markdown? (override)
 */
export async function POST(req: Request) {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Campo file requerido' }, { status: 400 });
  }

  const validacion = validarArchivoFormato(file);
  if (validacion) {
    return NextResponse.json({ error: validacion }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const tituloForm = String(form.get('titulo') ?? '').trim();
  const titulo =
    tituloForm || file.name.replace(/\.[^.]+$/, '').trim() || 'Formato legal';
  const tipoRaw = String(form.get('tipo') ?? 'contrato').trim() || 'contrato';
  const tipo = esTipoDocumentoLegal(tipoRaw) ? tipoRaw : 'otro';
  const codigo =
    String(form.get('codigo') ?? '').trim() ||
    slugCodigoPlantilla(titulo, 'formato_subido');
  const descripcion = String(form.get('descripcion') ?? '').trim() || null;
  const categoria = String(form.get('categoria') ?? 'general').trim() || 'general';
  const jurisdiccion =
    String(form.get('jurisdiccion') ?? 'venezuela').trim() || 'venezuela';
  const cuerpoOverride = String(form.get('cuerpo_markdown') ?? '').trim();

  const extracted = cuerpoOverride
    ? { cuerpo: cuerpoOverride, extraidoConIa: false }
    : await leerTextoArchivoFormato(buffer, file.name, mime);

  const storagePath = buildPlantillaStoragePath(gate.acceso.orgId!, file.name);
  const { error: upErr } = await gate.admin.storage
    .from(LEGAL_PLANTILLAS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (upErr) {
    const msg = upErr.message || 'Error al subir archivo';
    const hint = /bucket not found|not found/i.test(msg)
      ? 'Cree el bucket legal-plantillas (migración 273) en Supabase.'
      : HINT;
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }

  const variables = extraerVariablesDeCuerpo(extracted.cuerpo);

  const { data, error } = await gate.admin
    .from('ci_legal_plantillas')
    .insert({
      org_id: gate.acceso.orgId!,
      codigo: codigo.slice(0, 80),
      titulo,
      tipo,
      jurisdiccion,
      categoria,
      descripcion,
      cuerpo_markdown: extracted.cuerpo,
      variables,
      activo: true,
      archivo_storage_path: storagePath,
      archivo_nombre: file.name,
      archivo_mime: mime,
    })
    .select('*')
    .single();

  if (error) {
    await gate.admin.storage.from(LEGAL_PLANTILLAS_BUCKET).remove([storagePath]);
    if (/unique|duplicate/i.test(error.message)) {
      return NextResponse.json(
        {
          error: `Ya existe un formato con código «${codigo}». Cambie el código.`,
          hint: HINT,
        },
        { status: 409 },
      );
    }
    // Columnas archivo_* pueden faltar si no corrieron 273
    if (/archivo_|column/i.test(error.message)) {
      const retry = await gate.admin
        .from('ci_legal_plantillas')
        .insert({
          org_id: gate.acceso.orgId!,
          codigo: codigo.slice(0, 80),
          titulo,
          tipo,
          jurisdiccion,
          categoria,
          descripcion,
          cuerpo_markdown: extracted.cuerpo,
          variables,
          activo: true,
        })
        .select('*')
        .single();
      if (!retry.error && retry.data) {
        return NextResponse.json({
          ok: true,
          plantilla: retry.data,
          extraido_con_ia: extracted.extraidoConIa,
          warning:
            'Formato guardado sin metadatos de archivo. Ejecute la migración 273 para adjuntar el original.',
        });
      }
    }
    return NextResponse.json({ error: error.message, hint: HINT }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      plantilla: data,
      extraido_con_ia: extracted.extraidoConIa,
    },
    { status: 201 },
  );
}
