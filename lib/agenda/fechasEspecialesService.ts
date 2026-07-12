import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CategoriaFechaEspecial,
  ConsultarFechasEspecialesInput,
  FechaEspecial,
  GuardarFechaEspecialInput,
} from '@/types/agenda';

const CATEGORIAS: CategoriaFechaEspecial[] = [
  'birthday',
  'appointment',
  'reminder',
  'holiday',
];

function isCategoria(value: string): value is CategoriaFechaEspecial {
  return (CATEGORIAS as string[]).includes(value);
}

function normalizeHora(hora?: string): string | null {
  if (!hora?.trim()) return null;
  const trimmed = hora.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

export async function guardarFechaEspecial(
  supabase: SupabaseClient,
  userId: string | null,
  input: GuardarFechaEspecialInput,
): Promise<FechaEspecial> {
  if (!input.titulo?.trim()) {
    throw new Error('El título del evento es obligatorio.');
  }
  if (!isCategoria(input.categoria)) {
    throw new Error(`Categoría inválida: ${input.categoria}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    throw new Error('La fecha debe estar en formato YYYY-MM-DD.');
  }

  const { data, error } = await supabase
    .from('ci_fechas_especiales')
    .insert({
      user_id: userId,
      titulo: input.titulo.trim(),
      categoria: input.categoria,
      fecha: input.fecha,
      hora: normalizeHora(input.hora),
      notas: input.notas?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as FechaEspecial;
}

export async function consultarFechasEspeciales(
  supabase: SupabaseClient,
  userId: string | null,
  input: ConsultarFechasEspecialesInput = {},
): Promise<FechaEspecial[]> {
  if (input.categoria && !isCategoria(input.categoria)) {
    throw new Error(`Categoría inválida: ${input.categoria}`);
  }
  if (input.mes !== undefined && (input.mes < 1 || input.mes > 12)) {
    throw new Error('El mes debe estar entre 1 y 12.');
  }

  let query = supabase
    .from('ci_fechas_especiales')
    .select('*')
    .order('fecha', { ascending: true });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (input.categoria) {
    query = query.eq('categoria', input.categoria);
  }

  if (input.mes !== undefined) {
    const year = new Date().getFullYear();
    const month = String(input.mes).padStart(2, '0');
    const lastDay = new Date(year, input.mes, 0).getDate();
    query = query
      .gte('fecha', `${year}-${month}-01`)
      .lte('fecha', `${year}-${month}-${String(lastDay).padStart(2, '0')}`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as FechaEspecial[];
}
