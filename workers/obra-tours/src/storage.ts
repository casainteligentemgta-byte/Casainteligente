import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

function resolveServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    ''
  );
}

export function createWorkerSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  const key = resolveServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el worker',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function uploadModeloGlb(opts: {
  proyectoId: string;
  jobId: string;
  glb: Buffer;
}): Promise<{ bucket: string; path: string; publicUrl: string }> {
  const supabase = createWorkerSupabase();
  const bucket =
    process.env.OBRA_TOURS_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_MEDIA_BUCKET?.trim() ||
    'ci-proyectos-media';
  const path = `ci-proyectos/${opts.proyectoId}/tours/modelo/${opts.jobId}-${randomUUID()}.glb`;

  const { error } = await supabase.storage.from(bucket).upload(path, opts.glb, {
    contentType: 'model/gltf-binary',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    throw new Error(`Upload modelo falló: ${error.message}`);
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error('No se pudo obtener URL pública del modelo');
  }
  return { bucket, path, publicUrl: data.publicUrl };
}
