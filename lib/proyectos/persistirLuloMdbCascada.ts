import type { SupabaseClient } from '@supabase/supabase-js';
import {
  contarLuloMdbCascada,
  type LuloMdbCascadaModel,
} from '@/lib/proyectos/parseLuloMdbCascada';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

const BATCH = 200;

export type PersistirLuloMdbCascadaResult = {
  capitulos: number;
  partidas: number;
  apuItems: number;
  proyectoId: string;
};

async function ensureProyectoObra(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<void> {
  const pid = proyectoId.trim();

  const { data: existing, error: selErr } = await supabase
    .from('proyectos')
    .select('id')
    .eq('id', pid)
    .maybeSingle();
  if (selErr) throw new Error(formatErrorMessage(selErr));
  if (existing?.id) return;

  const { data: ci, error: ciErr } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, ubicacion_texto')
    .eq('id', pid)
    .maybeSingle();
  if (ciErr) throw new Error(formatErrorMessage(ciErr));
  if (!ci?.id) {
    throw new Error(
      `Proyecto ${pid} no existe en proyectos ni en ci_proyectos. Créelo antes de importar.`,
    );
  }

  const { error: insErr } = await supabase.from('proyectos').insert({
    id: ci.id,
    nombre: ci.nombre,
    ubicacion: ci.ubicacion_texto ?? '',
  });
  if (insErr && !/duplicate|unique/i.test(insErr.message)) {
    throw new Error(formatErrorMessage(insErr));
  }
}

/**
 * Persiste capítulos → partidas → apu_items en el esquema normalizado.
 * Si `reemplazar` es true, elimina capítulos previos del proyecto (cascade).
 */
export async function persistirLuloMdbCascada(
  supabase: SupabaseClient,
  proyectoId: string,
  model: LuloMdbCascadaModel,
  options?: { reemplazar?: boolean },
): Promise<PersistirLuloMdbCascadaResult> {
  const pid = proyectoId.trim();
  const reemplazar = options?.reemplazar ?? false;

  await ensureProyectoObra(supabase, pid);

  if (reemplazar) {
    const { error: delErr } = await supabase.from('capitulos').delete().eq('proyecto_id', pid);
    if (delErr) throw new Error(formatErrorMessage(delErr));
  }

  let capitulosInsertados = 0;
  let partidasInsertadas = 0;
  let apuItemsInsertados = 0;

  for (const cap of model.capitulos) {
    const { data: capRow, error: capErr } = await supabase
      .from('capitulos')
      .insert({
        proyecto_id: pid,
        codigo: cap.codigo.trim(),
        nombre: cap.nombre.trim().slice(0, 500),
      })
      .select('id')
      .single();
    if (capErr) throw new Error(formatErrorMessage(capErr));
    capitulosInsertados += 1;

    const capituloId = capRow.id as string;
    const partidaRows: Array<{
      capitulo_id: string;
      codigo: string;
      descripcion: string;
      unidad: string;
      cantidad_presupuestada: number;
    }> = cap.partidas.map((p) => ({
      capitulo_id: capituloId,
      codigo: p.codigo,
      descripcion: p.descripcion.slice(0, 800),
      unidad: p.unidad || 'UND',
      cantidad_presupuestada: p.cantidad_presupuestada,
    }));

    for (let i = 0; i < partidaRows.length; i += BATCH) {
      const batch = partidaRows.slice(i, i + BATCH);
      const { data: insertedPartidas, error: pErr } = await supabase
        .from('partidas')
        .insert(batch)
        .select('id, codigo');
      if (pErr) throw new Error(formatErrorMessage(pErr));

      partidasInsertadas += insertedPartidas?.length ?? 0;

      const partidaIdByCodigo = new Map<string, string>();
      for (const row of insertedPartidas ?? []) {
        if (row.codigo && row.id) {
          partidaIdByCodigo.set(String(row.codigo).trim().toUpperCase(), row.id);
        }
      }

      const apuBatch: Array<{
        partida_id: string;
        tipo: string;
        codigo_insumo: string;
        descripcion: string;
        unidad: string;
        rendimiento: number;
        costo_unitario: number;
      }> = [];

      for (const p of cap.partidas.slice(i, i + BATCH)) {
        const partidaId = partidaIdByCodigo.get(p.codigo.trim().toUpperCase());
        if (!partidaId) continue;
        for (const apu of p.apu) {
          apuBatch.push({
            partida_id: partidaId,
            tipo: apu.tipo,
            codigo_insumo: apu.codigo_insumo,
            descripcion: apu.descripcion,
            unidad: apu.unidad,
            rendimiento: apu.rendimiento,
            costo_unitario: apu.costo_unitario,
          });
        }
      }

      for (let j = 0; j < apuBatch.length; j += BATCH) {
        const apuSlice = apuBatch.slice(j, j + BATCH);
        if (apuSlice.length === 0) continue;
        const { error: aErr } = await supabase.from('apu_items').insert(apuSlice);
        if (aErr) throw new Error(formatErrorMessage(aErr));
        apuItemsInsertados += apuSlice.length;
      }
    }
  }

  const expected = contarLuloMdbCascada(model);
  if (partidasInsertadas === 0 && expected.partidas > 0) {
    throw new Error('No se insertó ninguna partida; revise permisos RLS o datos del MDB.');
  }

  return {
    capitulos: capitulosInsertados,
    partidas: partidasInsertadas,
    apuItems: apuItemsInsertados,
    proyectoId: pid,
  };
}
