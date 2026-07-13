import type { SupabaseClient } from '@supabase/supabase-js';
import { extractFullLuloMdb } from '@/lib/proyectos/extractLuloFull';
import { eliminarPartidasLuloDeProyecto } from '@/lib/proyectos/guardarPartidasPresupuestoBulk';
import { formatMdbReadError, toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import {
  contarLuloMdbCascada,
  parseAndValidateLuloMdbCascada,
} from '@/lib/proyectos/parseLuloMdbCascada';
import {
  persistirLuloMdbCascada,
  type PersistirLuloMdbCascadaResult,
} from '@/lib/proyectos/persistirLuloMdbCascada';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

export type PresupuestoLuloRow = {
  id: string;
  proyecto_id: string;
  codigo_obr: string;
  nombre: string;
  es_principal: boolean;
  orden: number;
  notas: string | null;
  created_at: string;
};

export async function listarPresupuestosLulo(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<PresupuestoLuloRow[]> {
  const { data, error } = await supabase
    .from('ci_proyecto_presupuestos_lulo')
    .select('id, proyecto_id, codigo_obr, nombre, es_principal, orden, notas, created_at')
    .eq('proyecto_id', proyectoId.trim())
    .order('orden')
    .order('created_at');
  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(formatErrorMessage(error));
  }
  return (data ?? []) as PresupuestoLuloRow[];
}

export async function obtenerPresupuestoLuloPrincipal(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<PresupuestoLuloRow | null> {
  const { data, error } = await supabase
    .from('ci_proyecto_presupuestos_lulo')
    .select('id, proyecto_id, codigo_obr, nombre, es_principal, orden, notas, created_at')
    .eq('proyecto_id', proyectoId.trim())
    .eq('es_principal', true)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') return null;
    throw new Error(formatErrorMessage(error));
  }
  return (data as PresupuestoLuloRow) ?? null;
}

export type CrearPresupuestoLuloInput = {
  proyectoId: string;
  codigoObr: string;
  nombre: string;
  esPrincipal?: boolean;
  notas?: string | null;
};

export async function crearPresupuestoLulo(
  supabase: SupabaseClient,
  input: CrearPresupuestoLuloInput,
): Promise<PresupuestoLuloRow> {
  const proyectoId = input.proyectoId.trim();
  const codigo_obr = input.codigoObr.trim();
  const esPrincipal = input.esPrincipal ?? false;

  if (esPrincipal) {
    await supabase
      .from('ci_proyecto_presupuestos_lulo')
      .update({ es_principal: false })
      .eq('proyecto_id', proyectoId);
    await supabase
      .from('ci_proyectos')
      .update({ codigo_lulo: codigo_obr, updated_at: new Date().toISOString() })
      .eq('id', proyectoId);
  }

  const { data: maxOrd } = await supabase
    .from('ci_proyecto_presupuestos_lulo')
    .select('orden')
    .eq('proyecto_id', proyectoId)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();

  const orden = (Number(maxOrd?.orden) || 0) + 1;

  const { data, error } = await supabase
    .from('ci_proyecto_presupuestos_lulo')
    .insert({
      proyecto_id: proyectoId,
      codigo_obr,
      nombre: input.nombre.trim().slice(0, 200) || codigo_obr,
      es_principal: esPrincipal,
      orden,
      notas: input.notas?.trim() || null,
    })
    .select('id, proyecto_id, codigo_obr, nombre, es_principal, orden, notas, created_at')
    .single();

  if (error) throw new Error(formatErrorMessage(error));
  return data as PresupuestoLuloRow;
}

export async function obtenerPresupuestoPorCodigoObr(
  supabase: SupabaseClient,
  proyectoId: string,
  codigoObr: string,
): Promise<PresupuestoLuloRow | null> {
  const { data, error } = await supabase
    .from('ci_proyecto_presupuestos_lulo')
    .select('id, proyecto_id, codigo_obr, nombre, es_principal, orden, notas, created_at')
    .eq('proyecto_id', proyectoId.trim())
    .eq('codigo_obr', codigoObr.trim())
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') return null;
    throw new Error(formatErrorMessage(error));
  }
  return (data as PresupuestoLuloRow) ?? null;
}

/** Crea o reutiliza el presupuesto Lulo del CodObr antes de importar cascada. */
export async function asegurarPresupuestoLuloParaImport(
  supabase: SupabaseClient,
  proyectoId: string,
  codigoObr: string,
  nombre?: string,
): Promise<PresupuestoLuloRow> {
  const cod = codigoObr.trim();
  const existing = await obtenerPresupuestoPorCodigoObr(supabase, proyectoId, cod);
  if (existing) return existing;

  const lista = await listarPresupuestosLulo(supabase, proyectoId);
  const esPrincipal = lista.length === 0;
  return crearPresupuestoLulo(supabase, {
    proyectoId,
    codigoObr: cod,
    nombre: nombre?.trim() || `Presupuesto ${cod}`,
    esPrincipal,
  });
}

/** Elimina presupuestos Lulo del proyecto (cascada capítulos/APU) y partidas Lulo en ci_presupuesto. */
export async function eliminarTodosPresupuestosLuloProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<void> {
  const pid = proyectoId.trim();
  const { error: delPres } = await supabase
    .from('ci_proyecto_presupuestos_lulo')
    .delete()
    .eq('proyecto_id', pid);
  if (delPres && delPres.code !== '42P01') throw new Error(formatErrorMessage(delPres));

  const { error: delCap } = await supabase.from('capitulos').delete().eq('proyecto_id', pid);
  if (delCap) throw new Error(formatErrorMessage(delCap));

  await eliminarPartidasLuloDeProyecto(supabase, pid);
}

export type CargarPresupuestoLuloResult = PersistirLuloMdbCascadaResult & {
  presupuesto: PresupuestoLuloRow;
  codigo_obr: string;
  nombreArchivo: string;
};

export type CargarPresupuestoLuloOptions = {
  codigoObr?: string;
  nombrePresupuesto?: string;
  nombreArchivo?: string;
};

/**
 * Borra presupuestos Lulo previos del proyecto e importa el MDB en cascada (capítulos → partidas → APU).
 */
export async function cargarPresupuestoLuloDesdeMdb(
  supabase: SupabaseClient,
  proyectoId: string,
  fileBuffer: Buffer | ArrayBuffer | Uint8Array,
  options?: CargarPresupuestoLuloOptions,
): Promise<CargarPresupuestoLuloResult> {
  const pid = proyectoId.trim();
  const buffer = toMdbNodeBuffer(fileBuffer);
  let dump;
  try {
    dump = extractFullLuloMdb(buffer);
  } catch (err) {
    throw new Error(formatMdbReadError(err));
  }

  let codigoObraFiltro = options?.codigoObr?.trim();
  if (!codigoObraFiltro) {
    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('codigo_lulo')
      .eq('id', pid)
      .maybeSingle();
    const cod = proy?.codigo_lulo;
    if (typeof cod === 'string' && cod.trim()) codigoObraFiltro = cod.trim();
  }

  const validacion = parseAndValidateLuloMdbCascada(dump, pid, {
    codigoObra: codigoObraFiltro,
  });
  if (!validacion.ok) {
    const msg = [...validacion.errors, validacion.hint].filter(Boolean).join(' ');
    const err = new Error(msg) as Error & { statusCode?: number; tablasDetectadas?: string[] };
    err.statusCode = 422;
    err.tablasDetectadas = validacion.tablasDetectadas;
    throw err;
  }

  await eliminarTodosPresupuestosLuloProyecto(supabase, pid);

  const codigoObr =
    options?.codigoObr?.trim() ||
    validacion.model.obra?.codigo_lulo?.trim() ||
    'LULO';
  const nombrePresupuesto =
    options?.nombrePresupuesto?.trim() ||
    validacion.model.obra?.nombre?.trim() ||
    `Presupuesto ${codigoObr}`;

  const presupuesto = await crearPresupuestoLulo(supabase, {
    proyectoId: pid,
    codigoObr,
    nombre: nombrePresupuesto,
    esPrincipal: true,
  });

  const persisted = await persistirLuloMdbCascada(supabase, pid, validacion.model, {
    reemplazar: false,
    presupuestoLuloId: presupuesto.id,
  });

  const conteos = contarLuloMdbCascada(validacion.model);
  if (persisted.partidas === 0 && conteos.partidas > 0) {
    throw new Error('No se insertó ninguna partida; revise permisos RLS o datos del MDB.');
  }

  return {
    ...persisted,
    presupuesto,
    codigo_obr: codigoObr,
    nombreArchivo: options?.nombreArchivo ?? 'presupuesto.mdb',
  };
}

export async function upsertPresupuestoLuloPrincipal(
  supabase: SupabaseClient,
  proyectoId: string,
  codigoObr: string,
  nombre: string,
): Promise<PresupuestoLuloRow> {
  const existing = await obtenerPresupuestoLuloPrincipal(supabase, proyectoId);
  if (existing) {
    const { data, error } = await supabase
      .from('ci_proyecto_presupuestos_lulo')
      .update({
        codigo_obr: codigoObr.trim(),
        nombre: nombre.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, proyecto_id, codigo_obr, nombre, es_principal, orden, notas, created_at')
      .single();
    if (error) throw new Error(formatErrorMessage(error));
    await supabase
      .from('ci_proyectos')
      .update({ codigo_lulo: codigoObr.trim() })
      .eq('id', proyectoId);
    return data as PresupuestoLuloRow;
  }
  return crearPresupuestoLulo(supabase, {
    proyectoId,
    codigoObr,
    nombre,
    esPrincipal: true,
  });
}
