'use server';

/**
 * Server Actions — cómputos métricos (`computos_metricos`).
 */
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import {
  calcularTotalComputado,
  type ComputoMetrico,
  type ComputoMetricoInput,
} from '@/types/computos';

export const TABLA_COMPUTOS_METRICOS = 'computos_metricos';

function clientOrThrow() {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) {
    throw new Error('Supabase admin no configurado (SUPABASE_SERVICE_ROLE_KEY).');
  }
  return admin.client;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function mapRowToComputoMetrico(row: Record<string, unknown>): ComputoMetrico {
  return {
    id: num(row.id),
    gasto_id: numOrNull(row.gasto_id),
    capitulo: String(row.capitulo ?? ''),
    subcapitulo: strOrNull(row.subcapitulo),
    partida_codigo: strOrNull(row.partida_codigo),
    descripcion_elemento: String(row.descripcion_elemento ?? ''),
    ubicacion: strOrNull(row.ubicacion),
    cantidad: num(row.cantidad, 1),
    largo: num(row.largo),
    ancho: num(row.ancho),
    alto_profundidad: num(row.alto_profundidad),
    unidad_medida: String(row.unidad_medida ?? 'm2'),
    formula_expresion: strOrNull(row.formula_expresion),
    total_computado: num(row.total_computado),
    soporte_url: strOrNull(row.soporte_url),
    observaciones: strOrNull(row.observaciones),
    created_at: row.created_at != null ? String(row.created_at) : '',
  };
}

function buildInsertPayload(data: ComputoMetricoInput): Record<string, unknown> {
  const cantidad = num(data.cantidad, 1);
  const largo = num(data.largo);
  const ancho = num(data.ancho);
  const alto = num(data.alto_profundidad);
  const unidad = String(data.unidad_medida ?? 'm2');
  const calc = calcularTotalComputado({
    unidad_medida: unidad,
    cantidad,
    largo,
    ancho,
    alto_profundidad: alto,
  });

  return {
    gasto_id: data.gasto_id === undefined ? null : numOrNull(data.gasto_id),
    capitulo: String(data.capitulo ?? '').trim(),
    subcapitulo: data.subcapitulo === undefined ? null : strOrNull(data.subcapitulo),
    partida_codigo: data.partida_codigo === undefined ? null : strOrNull(data.partida_codigo),
    descripcion_elemento: String(data.descripcion_elemento ?? '').trim(),
    ubicacion: data.ubicacion === undefined ? null : strOrNull(data.ubicacion),
    cantidad,
    largo,
    ancho,
    alto_profundidad: alto,
    unidad_medida: unidad,
    formula_expresion:
      data.formula_expresion !== undefined
        ? strOrNull(data.formula_expresion)
        : calc.formula,
    total_computado:
      data.total_computado !== undefined && Number.isFinite(Number(data.total_computado))
        ? num(data.total_computado)
        : calc.total,
    soporte_url: data.soporte_url === undefined ? null : strOrNull(data.soporte_url),
    observaciones: data.observaciones === undefined ? null : strOrNull(data.observaciones),
  };
}

function buildUpdatePayload(data: ComputoMetricoInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (data.gasto_id !== undefined) patch.gasto_id = numOrNull(data.gasto_id);
  if (data.capitulo !== undefined) patch.capitulo = String(data.capitulo).trim();
  if (data.subcapitulo !== undefined) patch.subcapitulo = strOrNull(data.subcapitulo);
  if (data.partida_codigo !== undefined) patch.partida_codigo = strOrNull(data.partida_codigo);
  if (data.descripcion_elemento !== undefined) {
    patch.descripcion_elemento = String(data.descripcion_elemento).trim();
  }
  if (data.ubicacion !== undefined) patch.ubicacion = strOrNull(data.ubicacion);
  if (data.cantidad !== undefined) patch.cantidad = num(data.cantidad, 1);
  if (data.largo !== undefined) patch.largo = num(data.largo);
  if (data.ancho !== undefined) patch.ancho = num(data.ancho);
  if (data.alto_profundidad !== undefined) patch.alto_profundidad = num(data.alto_profundidad);
  if (data.unidad_medida !== undefined) patch.unidad_medida = String(data.unidad_medida);
  if (data.soporte_url !== undefined) patch.soporte_url = strOrNull(data.soporte_url);
  if (data.observaciones !== undefined) patch.observaciones = strOrNull(data.observaciones);

  const needsRecalc =
    data.cantidad !== undefined ||
    data.largo !== undefined ||
    data.ancho !== undefined ||
    data.alto_profundidad !== undefined ||
    data.unidad_medida !== undefined ||
    data.total_computado !== undefined ||
    data.formula_expresion !== undefined;

  if (needsRecalc && data.total_computado === undefined) {
    // Recalc solo si el cliente no forzó total; requiere dims completas en el patch o las omitimos.
    // El cliente suele enviar el bloque completo desde el formulario.
  }

  if (data.total_computado !== undefined) {
    patch.total_computado = num(data.total_computado);
  }
  if (data.formula_expresion !== undefined) {
    patch.formula_expresion = strOrNull(data.formula_expresion);
  }

  if (
    data.total_computado === undefined &&
    (data.cantidad !== undefined ||
      data.largo !== undefined ||
      data.ancho !== undefined ||
      data.alto_profundidad !== undefined ||
      data.unidad_medida !== undefined)
  ) {
    const calc = calcularTotalComputado({
      unidad_medida: String(data.unidad_medida ?? patch.unidad_medida ?? 'm2'),
      cantidad: num(data.cantidad ?? patch.cantidad, 1),
      largo: num(data.largo ?? patch.largo),
      ancho: num(data.ancho ?? patch.ancho),
      alto_profundidad: num(data.alto_profundidad ?? patch.alto_profundidad),
    });
    patch.total_computado = calc.total;
    if (data.formula_expresion === undefined) patch.formula_expresion = calc.formula;
  }

  return patch;
}

/** Lista cómputos filtrados por capítulo (orden: más recientes primero). */
export async function getComputosByCapitulo(capitulo: string): Promise<ComputoMetrico[]> {
  const cap = String(capitulo ?? '').trim();
  if (!cap) return [];

  const sb = clientOrThrow();
  const { data, error } = await sb
    .from(TABLA_COMPUTOS_METRICOS)
    .select('*')
    .eq('capitulo', cap)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(
      /schema cache|does not exist|Could not find/i.test(error.message)
        ? `${error.message} · Aplique migración 279 (computos_metricos).`
        : error.message,
    );
  }

  return (data ?? []).map((row) => mapRowToComputoMetrico(row as Record<string, unknown>));
}

/** Lista por gasto_id (drawer de detalle CCO). */
export async function getComputosByGastoId(gastoId: number): Promise<ComputoMetrico[]> {
  const id = Number(gastoId);
  if (!Number.isFinite(id)) return [];

  const sb = clientOrThrow();
  const { data, error } = await sb
    .from(TABLA_COMPUTOS_METRICOS)
    .select('*')
    .eq('gasto_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(
      /schema cache|does not exist|Could not find/i.test(error.message)
        ? `${error.message} · Aplique migración 279 (computos_metricos).`
        : error.message,
    );
  }

  return (data ?? []).map((row) => mapRowToComputoMetrico(row as Record<string, unknown>));
}

/** Inserta una nueva línea de cómputo. */
export async function createComputo(data: ComputoMetricoInput): Promise<ComputoMetrico> {
  const descripcion = String(data.descripcion_elemento ?? '').trim();
  if (!descripcion) throw new Error('descripcion_elemento es requerida.');
  const capitulo = String(data.capitulo ?? '').trim();
  if (!capitulo) throw new Error('capitulo es requerido.');

  const sb = clientOrThrow();
  const payload = buildInsertPayload({ ...data, descripcion_elemento: descripcion, capitulo });
  const { data: row, error } = await sb
    .from(TABLA_COMPUTOS_METRICOS)
    .insert(payload as never)
    .select('*')
    .single();

  if (error) {
    throw new Error(
      /schema cache|does not exist|Could not find/i.test(error.message)
        ? `${error.message} · Aplique migración 279 (computos_metricos).`
        : error.message,
    );
  }

  return mapRowToComputoMetrico(row as Record<string, unknown>);
}

/** Actualiza un cómputo existente. */
export async function updateComputo(
  id: number,
  data: ComputoMetricoInput,
): Promise<ComputoMetrico> {
  const computoId = Number(id);
  if (!Number.isFinite(computoId)) throw new Error('id inválido.');

  const patch = buildUpdatePayload(data);
  if (Object.keys(patch).length === 0) {
    throw new Error('Sin campos para actualizar.');
  }

  const sb = clientOrThrow();
  const { data: row, error } = await sb
    .from(TABLA_COMPUTOS_METRICOS)
    .update(patch as never)
    .eq('id', computoId)
    .select('*')
    .single();

  if (error) {
    throw new Error(
      /schema cache|does not exist|Could not find/i.test(error.message)
        ? `${error.message} · Aplique migración 279 (computos_metricos).`
        : error.message,
    );
  }

  return mapRowToComputoMetrico(row as Record<string, unknown>);
}

/** Elimina una línea de cómputo. */
export async function deleteComputo(id: number): Promise<{ ok: true }> {
  const computoId = Number(id);
  if (!Number.isFinite(computoId)) throw new Error('id inválido.');

  const sb = clientOrThrow();
  const { error } = await sb.from(TABLA_COMPUTOS_METRICOS).delete().eq('id', computoId);

  if (error) {
    throw new Error(
      /schema cache|does not exist|Could not find/i.test(error.message)
        ? `${error.message} · Aplique migración 279 (computos_metricos).`
        : error.message,
    );
  }

  return { ok: true };
}
