import type { SupabaseClient } from '@supabase/supabase-js';
import { compressImageForUpload } from '@/lib/reclutamiento/compressImageForUpload';

export const COSTADOS_ACTIVO = ['frente', 'atras', 'izquierda', 'derecha'] as const;
export type CostadoActivo = (typeof COSTADOS_ACTIVO)[number];

export const ETIQUETA_COSTADO: Record<CostadoActivo, string> = {
  frente: 'Frente',
  atras: 'Atrás',
  izquierda: 'Izquierda',
  derecha: 'Derecha',
};

export type FotoCostadoRef = {
  url: string;
  storage_path: string;
};

export type FotosCostadosMap = Partial<Record<CostadoActivo, FotoCostadoRef | null>>;

function bucketsChain(): string[] {
  const fromEnv =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_PROJECT_MEDIA_BUCKET?.trim()
      : undefined;
  const chain = [fromEnv, 'ci-proyectos-media', 'product-media', 'productos'].filter(
    (b): b is string => Boolean(b),
  );
  const seen = new Set<string>();
  return chain.filter((b) => (seen.has(b) ? false : (seen.add(b), true)));
}

function bucketNotFound(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('bucket not found') || (m.includes('not found') && m.includes('bucket'));
}

function extOf(file: File): string {
  const n = file.name.split('.').pop()?.toLowerCase();
  if (n && /^[a-z0-9]+$/.test(n)) return n;
  return 'jpg';
}

export function parseFotosCostados(raw: unknown): FotosCostadosMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: FotosCostadosMap = {};
  for (const lado of COSTADOS_ACTIVO) {
    const v = o[lado];
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const r = v as Record<string, unknown>;
    const url = typeof r.url === 'string' ? r.url.trim() : '';
    const storage_path = typeof r.storage_path === 'string' ? r.storage_path.trim() : '';
    if (url) out[lado] = { url, storage_path };
  }
  return out;
}

export async function uploadFotoCostadoActivo(
  supabase: SupabaseClient,
  input: {
    entidadId: string;
    activoId: string;
    categoria: string;
    lado: CostadoActivo;
    file: File;
  },
): Promise<FotoCostadoRef> {
  if (!input.file.type.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes.');
  }
  const blob = await compressImageForUpload(input.file);
  const file =
    blob instanceof File
      ? blob
      : new File([blob], input.file.name.replace(/\.\w+$/, '') || `costado.jpg`, {
          type: blob.type.startsWith('image/') ? blob.type : 'image/jpeg',
        });
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Cada foto debe pesar menos de 12 MB.');
  }

  const ext = extOf(file);
  const cat = input.categoria.replace(/[^a-z0-9_-]/gi, '_') || 'activo';
  const path = `ci-activos/${input.entidadId}/${cat}/${input.activoId}/${input.lado}-${Date.now()}.${ext}`;

  let last = '';
  for (const bucket of bucketsChain()) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { url: data.publicUrl, storage_path: path };
    }
    last = error.message;
    if (!bucketNotFound(error.message)) throw new Error(error.message);
  }
  throw new Error(last || 'No hay bucket de almacenamiento disponible.');
}

export async function subirFotosCostadosPendientes(
  supabase: SupabaseClient,
  input: {
    entidadId: string;
    activoId: string;
    categoria: string;
    locales: Partial<Record<CostadoActivo, File | null | undefined>>;
  },
): Promise<FotosCostadosMap> {
  const out: FotosCostadosMap = {};
  for (const lado of COSTADOS_ACTIVO) {
    const file = input.locales[lado];
    if (!file) continue;
    out[lado] = await uploadFotoCostadoActivo(supabase, {
      entidadId: input.entidadId,
      activoId: input.activoId,
      categoria: input.categoria,
      lado,
      file,
    });
  }
  return out;
}
