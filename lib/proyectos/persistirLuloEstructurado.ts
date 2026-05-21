import type { SupabaseClient } from '@supabase/supabase-js';
import {
  bulkInsertCiPresupuestoPartidas,
  eliminarPartidasLuloDeProyecto,
} from '@/lib/proyectos/guardarPartidasPresupuestoBulk';
import type { LuloEstructuradoParse } from '@/lib/proyectos/parseLuloMdbEstructurado';

const BATCH = 200;

export type PersistirLuloEstructuradoResult = {
  insumosUpserted: number;
  partidasInsertadas: number;
  apuInsertados: number;
  proyectoActualizado: boolean;
};

async function upsertInsumosMaestro(
  supabase: SupabaseClient,
  insumos: LuloEstructuradoParse['insumos'],
): Promise<Map<string, string>> {
  const codigoToId = new Map<string, string>();
  if (insumos.length === 0) return codigoToId;

  const rows = insumos.map((i) => ({
    codigo: i.codigo,
    descripcion: i.descripcion,
    unidad: i.unidad || 'UND',
    precio_base: i.precio_base,
    tipo: i.tipo,
    origen: 'lulo_mdb',
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('ci_lulo_insumos_maestro')
      .upsert(batch, { onConflict: 'codigo' })
      .select('id, codigo');
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.codigo && row.id) {
        codigoToId.set(String(row.codigo).trim().toUpperCase(), row.id);
      }
    }
  }

  const codigos = insumos.map((i) => i.codigo.trim()).filter(Boolean);
  if (codigos.length > 0) {
    const { data: existing, error: selErr } = await supabase
      .from('ci_lulo_insumos_maestro')
      .select('id, codigo')
      .in('codigo', codigos);
    if (selErr) throw selErr;
    for (const row of existing ?? []) {
      if (row.codigo && row.id) {
        codigoToId.set(String(row.codigo).trim().toUpperCase(), row.id);
      }
    }
  }

  return codigoToId;
}

async function actualizarProyectoDesdeObra(
  supabase: SupabaseClient,
  proyectoId: string,
  obra: LuloEstructuradoParse['obra'],
): Promise<boolean> {
  if (!obra?.codigo_lulo) return false;

  const patch: Record<string, unknown> = {
    codigo_lulo: obra.codigo_lulo,
    updated_at: new Date().toISOString(),
  };
  if (obra.porcentaje_admin != null && obra.porcentaje_admin > 0) {
    patch.porcentaje_admin = obra.porcentaje_admin;
  }
  if (obra.porcentaje_utilidad != null && obra.porcentaje_utilidad > 0) {
    patch.porcentaje_utilidad = obra.porcentaje_utilidad;
  }
  if (obra.porcentaje_fcm != null && obra.porcentaje_fcm >= 0) {
    patch.porcentaje_fcm = obra.porcentaje_fcm;
  }

  const { error } = await supabase.from('ci_proyectos').update(patch).eq('id', proyectoId);
  if (error) {
    if (error.message.includes('codigo_lulo') || error.code === '42703') {
      return false;
    }
    throw error;
  }
  return true;
}

async function mapPartidaIds(
  supabase: SupabaseClient,
  proyectoId: string,
  codigos: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (codigos.length === 0) return map;

  for (let i = 0; i < codigos.length; i += BATCH) {
    const batch = codigos.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('ci_presupuesto_partidas')
      .select('id, codigo_partida')
      .eq('proyecto_id', proyectoId)
      .in('codigo_partida', batch);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.codigo_partida && row.id) {
        map.set(String(row.codigo_partida).trim().toUpperCase(), row.id);
      }
    }
  }
  return map;
}

async function insertApu(
  supabase: SupabaseClient,
  apu: LuloEstructuradoParse['apu'],
  partidaIds: Map<string, string>,
  insumoIds: Map<string, string>,
): Promise<number> {
  const rows: Array<{
    partida_id: string;
    insumo_id: string;
    cantidad_rendimiento: number;
    desperdicio_porcentaje: number;
    origen: string;
  }> = [];

  for (const line of apu) {
    const partidaId = partidaIds.get(line.codigo_partida.trim().toUpperCase());
    const insumoId = insumoIds.get(line.codigo_insumo.trim().toUpperCase());
    if (!partidaId || !insumoId) continue;
    rows.push({
      partida_id: partidaId,
      insumo_id: insumoId,
      cantidad_rendimiento: line.cantidad_rendimiento,
      desperdicio_porcentaje: line.desperdicio_porcentaje,
      origen: 'lulo_mdb',
    });
  }

  if (rows.length === 0) return 0;

  let insertados = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('ci_presupuesto_partida_apu').insert(batch);
    if (error) throw error;
    insertados += batch.length;
  }
  return insertados;
}

/**
 * Persiste importación Lulo nativa: insumos maestro, partidas, APU y metadatos de obra.
 */
export async function persistirLuloEstructurado(
  supabase: SupabaseClient,
  proyectoId: string,
  parsed: LuloEstructuradoParse,
  options?: { reemplazar?: boolean },
): Promise<PersistirLuloEstructuradoResult> {
  const pid = proyectoId.trim();
  const reemplazar = options?.reemplazar ?? false;

  const insumoIds = await upsertInsumosMaestro(supabase, parsed.insumos);
  const proyectoActualizado = await actualizarProyectoDesdeObra(supabase, pid, parsed.obra);

  if (reemplazar) {
    await eliminarPartidasLuloDeProyecto(supabase, pid);
  }

  const { insertadas } = await bulkInsertCiPresupuestoPartidas(supabase, pid, parsed.partidas, {
    reemplazar: false,
  });

  const codigosPartida = parsed.partidas.map((p) => p.codigo_partida.trim()).filter(Boolean);
  const partidaIds = await mapPartidaIds(supabase, pid, codigosPartida);

  const codigosInsumoApu = Array.from(
    new Set(parsed.apu.map((a) => a.codigo_insumo.trim())),
  ).filter(Boolean);
  for (const cod of codigosInsumoApu) {
    if (!insumoIds.has(cod.toUpperCase())) {
      const { data } = await supabase
        .from('ci_lulo_insumos_maestro')
        .select('id, codigo')
        .eq('codigo', cod)
        .maybeSingle();
      if (data?.id) insumoIds.set(cod.toUpperCase(), data.id);
    }
  }

  const apuInsertados = await insertApu(supabase, parsed.apu, partidaIds, insumoIds);

  return {
    insumosUpserted: parsed.insumos.length,
    partidasInsertadas: insertadas,
    apuInsertados,
    proyectoActualizado,
  };
}
