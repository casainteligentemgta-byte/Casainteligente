import type { SupabaseClient } from '@supabase/supabase-js';

export type CapituloObraRow = {
  id: string;
  codigo: string;
  nombre: string;
  num_cap: number | null;
};

/** Asegura fila en `proyectos` (FK cascada Lulo) para un `ci_proyectos.id`. */
export async function ensureProyectoObraMinimo(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<void> {
  const pid = proyectoId.trim();
  const { data: existing } = await supabase.from('proyectos').select('id').eq('id', pid).maybeSingle();
  if (existing?.id) return;

  const { data: ci } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, ubicacion_texto')
    .eq('id', pid)
    .maybeSingle();
  if (!ci?.id) {
    throw new Error('Proyecto no encontrado.');
  }

  const { error } = await supabase.from('proyectos').insert({
    id: ci.id,
    nombre: ci.nombre,
    ubicacion: ci.ubicacion_texto ?? '',
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function listarCapitulosObra(
  supabase: SupabaseClient,
  proyectoId: string,
  limite = 40,
): Promise<CapituloObraRow[]> {
  const { data, error } = await supabase
    .from('capitulos')
    .select('id, codigo, nombre, num_cap')
    .eq('proyecto_id', proyectoId.trim())
    .order('num_cap', { ascending: true, nullsFirst: false })
    .order('codigo')
    .limit(limite);

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => ({
    id: String(c.id),
    codigo: String(c.codigo ?? ''),
    nombre: String(c.nombre ?? ''),
    num_cap: c.num_cap != null ? Number(c.num_cap) : null,
  }));
}

function parseCodigoNombreCapitulo(texto: string): { codigo: string; nombre: string } {
  const t = texto.trim();
  const m = t.match(/^(\d+(?:\.\d+)?)\s*[-–.:]?\s*(.+)$/);
  if (m) {
    const num = parseInt(m[1].replace(/\D/g, ''), 10);
    const codigo = Number.isFinite(num) && num > 0 ? String(num).padStart(2, '0') : m[1].trim();
    return { codigo, nombre: m[2].trim().slice(0, 500) };
  }
  return { codigo: '', nombre: t.slice(0, 500) };
}

async function siguienteCodigoCapitulo(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<string> {
  const { data } = await supabase
    .from('capitulos')
    .select('codigo, num_cap')
    .eq('proyecto_id', proyectoId);

  let max = 0;
  for (const row of data ?? []) {
    const n =
      row.num_cap != null
        ? Number(row.num_cap)
        : parseInt(String(row.codigo ?? '').replace(/\D/g, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(2, '0');
}

/** Crea capítulo desde Telegram u otro canal de campo. */
export async function crearCapituloObra(
  supabase: SupabaseClient,
  params: { proyectoId: string; titulo: string },
): Promise<CapituloObraRow> {
  const pid = params.proyectoId.trim();
  const titulo = params.titulo.trim();
  if (titulo.length < 2) {
    throw new Error('El título del capítulo es muy corto.');
  }

  await ensureProyectoObraMinimo(supabase, pid);

  let { codigo, nombre } = parseCodigoNombreCapitulo(titulo);
  if (!nombre) nombre = titulo;
  if (!codigo) codigo = await siguienteCodigoCapitulo(supabase, pid);

  const numCap = parseInt(codigo.replace(/\D/g, ''), 10);
  const insert: Record<string, unknown> = {
    proyecto_id: pid,
    codigo,
    nombre,
  };
  if (Number.isFinite(numCap) && numCap > 0) insert.num_cap = numCap;

  const { data, error } = await supabase
    .from('capitulos')
    .insert(insert)
    .select('id, codigo, nombre, num_cap')
    .single();

  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      throw new Error(`Ya existe el capítulo con código ${codigo}.`);
    }
    throw new Error(error.message);
  }

  return {
    id: String(data.id),
    codigo: String(data.codigo),
    nombre: String(data.nombre),
    num_cap: data.num_cap != null ? Number(data.num_cap) : null,
  };
}
