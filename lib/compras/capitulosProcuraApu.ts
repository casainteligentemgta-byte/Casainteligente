import type { SupabaseClient } from '@supabase/supabase-js';

/** Catálogo alineado con Control de obra → Análisis APU (sidebar Lulo). */
export const CAPITULOS_PROCURA_APU = [
  { codigo: '01', nombre: 'Demolición y obras provisionales' },
  { codigo: '02', nombre: 'Estructura' },
  { codigo: '03', nombre: 'Albañilería' },
  { codigo: '04', nombre: 'Instalaciones eléctricas' },
  { codigo: '05', nombre: 'Instalaciones sanitarias' },
  { codigo: '06', nombre: 'Pozo de agua' },
  { codigo: '07', nombre: 'Piscina' },
  { codigo: '08', nombre: 'Muro ciclópeo' },
] as const;

const CODIGOS_LEGACY = ['CAP-I', 'CAP-II', 'CAP-III', 'CAP-IV', 'CAP-V'];

/** Garantiza los 8 capítulos APU en `ci_compras_capitulos_maestro` y desactiva el seed genérico CAP-*. */
export async function ensureCapitulosProcuraApu(supabase: SupabaseClient): Promise<void> {
  const { error: legacyErr } = await supabase
    .from('ci_compras_capitulos_maestro')
    .update({ activo: false })
    .in('codigo', CODIGOS_LEGACY);
  if (legacyErr?.code === '42P01') return;
  if (legacyErr) throw new Error(legacyErr.message);

  for (const cap of CAPITULOS_PROCURA_APU) {
    const { error } = await supabase.from('ci_compras_capitulos_maestro').upsert(
      { codigo: cap.codigo, nombre: cap.nombre, activo: true },
      { onConflict: 'codigo' },
    );
    if (error?.code === '42P01') return;
    if (error) throw new Error(error.message);
  }
}

function parseCodigoNombreCapitulo(texto: string): { codigo: string; nombre: string } {
  const t = texto.trim();
  const m = t.match(/^(\d+(?:\.\d+)?)\s*[-–.:]?\s*(.+)$/);
  if (m) {
    const num = parseInt(m[1].replace(/\D/g, ''), 10);
    const codigo = Number.isFinite(num) && num > 0 ? String(num).padStart(2, '0') : m[1].trim();
    return { codigo, nombre: m[2].trim().slice(0, 100) };
  }
  return { codigo: '', nombre: t.slice(0, 100) };
}

async function siguienteCodigoCapituloMaestro(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('ci_compras_capitulos_maestro')
    .select('codigo');

  if (error?.code === '42P01') return '09';
  if (error) throw new Error(error.message);

  let max = 8;
  for (const row of data ?? []) {
    const n = parseInt(String(row.codigo ?? '').replace(/\D/g, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(2, '0');
}

/** Alta dinámica desde Telegram (/procura → Crear el capítulo). */
export async function crearCapituloMaestroProcura(
  supabase: SupabaseClient,
  titulo: string,
): Promise<{ id: string; codigo: string; nombre: string }> {
  const t = titulo.trim();
  if (t.length < 2) {
    throw new Error('El título del capítulo es muy corto.');
  }

  let { codigo, nombre } = parseCodigoNombreCapitulo(t);
  if (!nombre) nombre = t;
  if (!codigo) codigo = await siguienteCodigoCapituloMaestro(supabase);

  const { data, error } = await supabase
    .from('ci_compras_capitulos_maestro')
    .upsert(
      { codigo, nombre, activo: true },
      { onConflict: 'codigo' },
    )
    .select('id, codigo, nombre')
    .single();

  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      throw new Error(`Ya existe el capítulo con código ${codigo}.`);
    }
    throw new Error(error.message);
  }

  return {
    id: String(data.id),
    codigo: String(data.codigo ?? codigo),
    nombre: String(data.nombre ?? nombre),
  };
}
