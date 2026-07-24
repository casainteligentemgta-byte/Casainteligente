import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BUCKET_CONTRATOS_OBREROS,
  signedUrlContratoLaboralBucket,
} from '@/lib/talento/contratoLaboralRegistroStorage';

export type ContratoPdfResolverResult =
  | { ok: true; source: 'storage'; signedUrl?: string; expires_sec: number }
  | { ok: true; source: 'generate' }
  | { ok: false; error: string; status: number };

/** Acepta ruta relativa en bucket o URL completa de Storage. */
export function normalizarRutaContratosObreros(path: string): string {
  const p = path.trim();
  if (!p) return '';
  if (!p.includes('://')) return p.replace(/^\/+/, '');
  try {
    const u = new URL(p);
    const marker = '/contratos_obreros/';
    const i = u.pathname.indexOf(marker);
    if (i >= 0) return decodeURIComponent(u.pathname.slice(i + marker.length));
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('contratos_obreros');
    if (idx >= 0 && idx < parts.length - 1) {
      return parts.slice(idx + 1).join('/');
    }
  } catch {
    /* no es URL */
  }
  return p.replace(/^\/+/, '');
}

function isMissingColumn(msg: string): boolean {
  return /column|does not exist|42703/i.test(msg);
}

type ExpressPathsRow = {
  id?: string;
  pdf_storage_path?: string | null;
  pdf_firmado_storage_path?: string | null;
};

type ContratoObraPathsRow = {
  id?: string;
  laboral_pdf_storage_path?: string | null;
  storage_path_borrador?: string | null;
  storage_path_firmado?: string | null;
  laboral_escaneo_firmado_storage_path?: string | null;
};

function pathsEmpleadoObra(row: ContratoObraPathsRow): string[] {
  const out: string[] = [];
  for (const p of [
    row.storage_path_firmado,
    row.laboral_pdf_storage_path,
    row.storage_path_borrador,
    row.laboral_escaneo_firmado_storage_path,
  ]) {
    const s = normalizarRutaContratosObreros(String(p ?? ''));
    if (s) out.push(s);
  }
  return out;
}

async function signedUrlFromPaths(
  supabase: SupabaseClient,
  paths: string[],
  expiresSec: number,
): Promise<{ url: string } | null> {
  for (const path of paths) {
    const signed = await signedUrlContratoLaboralBucket(supabase, path, expiresSec);
    if (!('error' in signed)) return { url: signed.url };
  }
  return null;
}

export async function resolverContratoPdfExpress(
  supabase: SupabaseClient,
  expressId: string,
  opts: { preferFirmado?: boolean },
): Promise<ContratoPdfResolverResult> {
  const id = expressId.trim();
  if (!id) return { ok: false, error: 'Falta id de contrato express.', status: 400 };

  let row: ExpressPathsRow | null = null;
  let selErr: { message: string } | null = null;

  const full = await supabase
    .from('ci_contratos_express')
    .select('id,pdf_storage_path,pdf_firmado_storage_path')
    .eq('id', id)
    .maybeSingle();

  if (full.error && isMissingColumn(full.error.message)) {
    const lite = await supabase.from('ci_contratos_express').select('id,pdf_storage_path').eq('id', id).maybeSingle();
    row = (lite.data as ExpressPathsRow | null) ?? null;
    selErr = lite.error;
  } else {
    row = (full.data as ExpressPathsRow | null) ?? null;
    selErr = full.error;
  }

  if (selErr || !row) {
    return { ok: false, error: selErr?.message ?? 'Contrato express no encontrado.', status: 404 };
  }

  const paths: string[] = [];
  if (opts.preferFirmado) {
    const firmado = normalizarRutaContratosObreros(String(row.pdf_firmado_storage_path ?? ''));
    if (firmado) paths.push(firmado);
    else if (!normalizarRutaContratosObreros(String(row.pdf_storage_path ?? ''))) {
      return {
        ok: false,
        error: 'Aún no hay documento firmado subido para este contrato express.',
        status: 404,
      };
    }
  }
  const generado = normalizarRutaContratosObreros(String(row.pdf_storage_path ?? ''));
  if (generado) paths.push(generado);

  if (!paths.length) {
    return { ok: true, source: 'generate' };
  }

  const signed = await signedUrlFromPaths(supabase, paths, 3600);
  return {
    ok: true,
    source: 'storage',
    signedUrl: signed?.url,
    expires_sec: 3600,
  };
}

export async function resolverContratoPdfEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<ContratoPdfResolverResult> {
  const id = empleadoId.trim();
  if (!id) return { ok: false, error: 'Falta id de empleado.', status: 400 };

  const { data, error } = await supabase
    .from('ci_contratos_empleado_obra')
    .select(
      'id,laboral_pdf_storage_path,storage_path_borrador,storage_path_firmado,laboral_escaneo_firmado_storage_path',
    )
    .eq('empleado_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && isMissingColumn(error.message)) {
    const lite = await supabase
      .from('ci_contratos_empleado_obra')
      .select('id,laboral_pdf_storage_path,storage_path_borrador')
      .eq('empleado_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lite.error) {
      return { ok: false, error: lite.error.message, status: 500 };
    }
    const paths = pathsEmpleadoObra((lite.data as ContratoObraPathsRow | null) ?? {});
    const signed = paths.length ? await signedUrlFromPaths(supabase, paths, 3600) : null;
    if (paths.length) {
      return { ok: true, source: 'storage', signedUrl: signed?.url, expires_sec: 3600 };
    }
    return { ok: true, source: 'generate' };
  }

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  const paths = pathsEmpleadoObra((data as ContratoObraPathsRow | null) ?? {});
  if (paths.length) {
    const signed = await signedUrlFromPaths(supabase, paths, 3600);
    return { ok: true, source: 'storage', signedUrl: signed?.url, expires_sec: 3600 };
  }

  return { ok: true, source: 'generate' };
}

export async function descargarPdfDesdeStorage(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<{ ok: true; data: Blob } | { ok: false; error: string }> {
  const path = normalizarRutaContratosObreros(storagePath);
  if (!path) return { ok: false, error: 'Ruta de almacenamiento vacía.' };
  const { data, error } = await supabase.storage.from(BUCKET_CONTRATOS_OBREROS).download(path);
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'No se pudo descargar el PDF.' };
  }
  return { ok: true, data };
}

export async function primeraRutaStorageEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ci_contratos_empleado_obra')
    .select(
      'laboral_pdf_storage_path,storage_path_borrador,storage_path_firmado,laboral_escaneo_firmado_storage_path',
    )
    .eq('empleado_id', empleadoId.trim())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const paths = pathsEmpleadoObra(data as ContratoObraPathsRow);
  return paths[0] ?? null;
}

export async function primeraRutaStorageExpress(
  supabase: SupabaseClient,
  expressId: string,
  preferFirmado: boolean,
): Promise<string | null> {
  const full = await supabase
    .from('ci_contratos_express')
    .select('pdf_storage_path,pdf_firmado_storage_path')
    .eq('id', expressId.trim())
    .maybeSingle();
  const row = (full.data as ExpressPathsRow | null) ?? {};
  if (preferFirmado) {
    const f = normalizarRutaContratosObreros(String(row.pdf_firmado_storage_path ?? ''));
    if (f) return f;
  }
  return normalizarRutaContratosObreros(String(row.pdf_storage_path ?? '')) || null;
}
