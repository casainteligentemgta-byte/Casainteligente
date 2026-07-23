import { NextResponse } from 'next/server';
import { requireAccesoLegal } from '@/lib/legal/requireAccesoLegal';
import {
  ingestLegalDocumentText,
  metadataParaDocumentoClase,
  type LegalDocumentoClase,
  LEGAL_FUENTE_CCT,
  LEGAL_FUENTE_CONTRATACION_COLECTIVA,
} from '@/lib/legal/ingestLegalKnowledge';
import {
  leerTextoDocumentoLegalCompleto,
  validarArchivoFormato,
} from '@/lib/legal/leerTextoDocumentoLegal';
import {
  buildPlantillaStoragePath,
  LEGAL_PLANTILLAS_BUCKET,
  slugCodigoPlantilla,
  extraerVariablesDeCuerpo,
  esTipoDocumentoLegal,
} from '@/lib/legal/plantillasFormatos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HINT =
  'Ejecute migraciones 268 (ci_legal_knowledge), 271–273 (plantillas) y configure OPENAI_API_KEY.';

function parseClase(raw: string): LegalDocumentoClase {
  const v = raw.trim().toLowerCase();
  if (v === 'convencion_colectiva' || v === 'cct' || v === 'convencion') {
    return 'convencion_colectiva';
  }
  if (
    v === 'contratacion_colectiva_obrera' ||
    v === 'contratacion_colectiva' ||
    v === 'contrato_colectivo'
  ) {
    return 'contratacion_colectiva_obrera';
  }
  return 'otro';
}

/**
 * POST multipart — carga Convención colectiva o Contratación colectiva obrera.
 * Indexa en ci_legal_knowledge (Asesor) y, si es contratación colectiva, también
 * crea formato en ci_legal_plantillas para usarlo en Documentos.
 *
 * Campos: file, clase (convencion_colectiva|contratacion_colectiva_obrera),
 * titulo?, referencia?, fecha_vigencia?, reemplazar?=1
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

  const clase = parseClase(String(form.get('clase') ?? 'convencion_colectiva'));
  const tituloForm = String(form.get('titulo') ?? '').trim();
  const titulo =
    tituloForm ||
    file.name.replace(/\.[^.]+$/, '').trim() ||
    (clase === 'convencion_colectiva'
      ? 'Convención colectiva del trabajo'
      : 'Contratación colectiva obrera');
  const referencia =
    String(form.get('referencia') ?? '').trim() || titulo;
  const fechaVigencia =
    String(form.get('fecha_vigencia') ?? '').trim().slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const reemplazar = String(form.get('reemplazar') ?? '1') !== '0';
  const tambienPlantilla =
    String(form.get('crear_formato') ?? '').trim() === '1' ||
    clase === 'contratacion_colectiva_obrera';

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';

  let texto: string;
  let extraidoConIa = false;
  try {
    const extracted = await leerTextoDocumentoLegalCompleto(buffer, file.name, mime);
    texto = extracted.texto;
    extraidoConIa = extracted.extraidoConIa;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const storagePath = buildPlantillaStoragePath(
    gate.acceso.orgId!,
    `conocimiento-${file.name}`,
  );
  const { error: upErr } = await gate.admin.storage
    .from(LEGAL_PLANTILLAS_BUCKET)
    .upload(storagePath, buffer, { contentType: mime, upsert: false });

  if (upErr) {
    const msg = upErr.message || 'Error al guardar archivo';
    const hint = /bucket not found|not found/i.test(msg)
      ? 'Cree el bucket legal-plantillas (migración 273).'
      : HINT;
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }

  const meta = metadataParaDocumentoClase(clase, referencia, {
    fecha_vigencia: fechaVigencia,
    capitulo: titulo,
  });

  let ingestResult: { chunks: number; source: string | null };
  try {
    ingestResult = await ingestLegalDocumentText(gate.admin, texto, meta, {
      replaceSource: reemplazar,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, hint: HINT }, { status: 500 });
  }

  let plantilla: Record<string, unknown> | null = null;
  if (tambienPlantilla) {
    const tipoDoc = esTipoDocumentoLegal('contrato') ? 'contrato' : 'otro';
    const codigo = slugCodigoPlantilla(
      titulo,
      clase === 'contratacion_colectiva_obrera'
        ? 'contratacion_colectiva_obrera'
        : 'convencion_colectiva',
    );
    const { data: pRow, error: pErr } = await gate.admin
      .from('ci_legal_plantillas')
      .insert({
        org_id: gate.acceso.orgId!,
        codigo: `${codigo}_${Date.now().toString(36)}`.slice(0, 80),
        titulo,
        tipo: tipoDoc,
        jurisdiccion: 'venezuela',
        categoria:
          clase === 'convencion_colectiva'
            ? 'convencion_colectiva'
            : 'contratacion_colectiva',
        descripcion: `Cargado desde ${file.name} · indexado en asesor (${meta.source})`,
        cuerpo_markdown: texto.slice(0, 200_000),
        variables: extraerVariablesDeCuerpo(texto),
        activo: true,
        archivo_storage_path: storagePath,
        archivo_nombre: file.name,
        archivo_mime: mime,
      })
      .select('id, codigo, titulo, tipo, categoria, archivo_nombre')
      .maybeSingle();

    if (!pErr && pRow) plantilla = pRow as Record<string, unknown>;
  }

  return NextResponse.json({
    ok: true,
    clase,
    titulo,
    referencia,
    chunks: ingestResult.chunks,
    source: ingestResult.source ?? meta.source,
    archivo_storage_path: storagePath,
    extraido_con_ia: extraidoConIa,
    plantilla,
    regimen_sugerido:
      clase === 'convencion_colectiva'
        ? {
            id: 'cct_construccion',
            nota: 'Si es CCT de construcción, use régimen CCT (100 utilidades / 80 bono) en Cálculos. Confirme los días según su convenio.',
          }
        : null,
    hint_asesor:
      'El Asesor legal ya puede citar este documento. En Cálculos elija el régimen de días (LOTTT o CCT).',
  });
}

/** GET — listar fuentes de conocimiento colectivo ya indexadas. */
export async function GET() {
  const gate = await requireAccesoLegal();
  if (!gate.ok) return gate.response;

  const sources = [LEGAL_FUENTE_CCT, LEGAL_FUENTE_CONTRATACION_COLECTIVA];

  const { data, error } = await gate.admin
    .from('ci_legal_knowledge')
    .select('source, referencia, tipo, fecha_vigencia, created_at')
    .in('source', sources)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: 'Ejecute migración 268 (ci_legal_knowledge).',
        fuentes: [],
      },
      { status: 500 },
    );
  }

  const map = new Map<
    string,
    {
      source: string;
      referencia: string | null;
      tipo: string | null;
      fecha_vigencia: string | null;
      fragmentos: number;
      ultimo_at: string | null;
    }
  >();

  for (const row of data ?? []) {
    const key = `${row.source}::${row.referencia ?? ''}`;
    const cur = map.get(key);
    if (cur) {
      cur.fragmentos += 1;
      if (row.created_at && (!cur.ultimo_at || row.created_at > cur.ultimo_at)) {
        cur.ultimo_at = row.created_at;
      }
    } else {
      map.set(key, {
        source: String(row.source ?? ''),
        referencia: row.referencia ?? null,
        tipo: row.tipo ?? null,
        fecha_vigencia: row.fecha_vigencia
          ? String(row.fecha_vigencia).slice(0, 10)
          : null,
        fragmentos: 1,
        ultimo_at: row.created_at ? String(row.created_at) : null,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    fuentes: Array.from(map.values()),
  });
}
