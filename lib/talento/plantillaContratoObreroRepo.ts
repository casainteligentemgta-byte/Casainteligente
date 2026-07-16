import type { SupabaseClient } from '@supabase/supabase-js';
import { CONTRATO_OBRERO_CUERPO_DEFAULT } from '@/lib/talento/plantillas/contratoObreroDefaultCuerpo';

const CODIGO = 'contrato_obrero';

export async function obtenerCuerpoPlantillaContratoObrero(client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from('ci_documento_plantillas')
    .select('cuerpo')
    .eq('codigo', CODIGO)
    .eq('activo', true)
    .maybeSingle();

  if (!error && data && typeof (data as { cuerpo?: string }).cuerpo === 'string') {
    const c = String((data as { cuerpo: string }).cuerpo).trim();
    if (c.length > 80) return c;
  }

  const ins = await client.from('ci_documento_plantillas').upsert(
    {
      codigo: CODIGO,
      titulo: 'Contrato individual de trabajo (obrero)',
      descripcion:
        'Plantilla con marcadores {{VARIABLE}}. Editable en Talento → Biblioteca de documentos. Revise con legal.',
      cuerpo: CONTRATO_OBRERO_CUERPO_DEFAULT,
      activo: true,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: 'codigo' },
  );

  if (ins.error) {
    console.warn('[plantilla contrato obrero] upsert plantilla:', ins.error.message);
    return CONTRATO_OBRERO_CUERPO_DEFAULT;
  }

  const { data: again } = await client.from('ci_documento_plantillas').select('cuerpo').eq('codigo', CODIGO).maybeSingle();
  const c2 = String((again as { cuerpo?: string } | null)?.cuerpo ?? '').trim();
  return c2.length > 80 ? c2 : CONTRATO_OBRERO_CUERPO_DEFAULT;
}

export async function listarPlantillasDocumento(client: SupabaseClient) {
  const { data, error } = await client
    .from('ci_documento_plantillas')
    .select('id,codigo,titulo,descripcion,version,activo,updated_at')
    .order('codigo', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function obtenerPlantillaPorCodigo(client: SupabaseClient, codigo: string) {
  const c = codigo.trim();
  if (!c) return null;
  const { data, error } = await client.from('ci_documento_plantillas').select('*').eq('codigo', c).maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    codigo: string;
    titulo: string;
    descripcion: string | null;
    cuerpo: string;
    version: number;
    activo: boolean;
    updated_at: string;
  } | null;
}

export async function guardarPlantillaPorCodigo(
  client: SupabaseClient,
  codigo: string,
  patch: { titulo?: string; descripcion?: string | null; cuerpo?: string; activo?: boolean },
) {
  const c = codigo.trim();
  if (!c) throw new Error('codigo requerido');
  const row: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await client
    .from('ci_documento_plantillas')
    .update(row as never)
    .eq('codigo', c)
    .select('id,codigo,titulo,updated_at')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
