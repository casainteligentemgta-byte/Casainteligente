import type { SupabaseClient } from '@supabase/supabase-js';
import { labelPartida, type PartidaRow } from '@/lib/almacen/inventoryClasificacion';
import type { PartidaProyectoDespacho } from '@/lib/almacen/listarPartidasProyectoDespacho';

export async function listarPartidasCapituloDespacho(
  supabase: SupabaseClient,
  proyectoId: string,
  capituloId: string,
): Promise<PartidaProyectoDespacho[]> {
  const pid = proyectoId.trim();
  const capId = capituloId.trim();
  if (!pid || !capId) return [];

  const out: PartidaProyectoDespacho[] = [];
  const seen = new Set<string>();

  if (capId.startsWith('pres:')) {
    const codCap = capId.slice(5);
    const { data, error } = await supabase
      .from('ci_presupuesto_partidas')
      .select('id,codigo_partida,descripcion,proyecto_id,capitulo_codigo')
      .eq('proyecto_id', pid)
      .eq('capitulo_codigo', codCap)
      .order('codigo_partida');

    if (error?.code === '42P01') return [];
    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as PartidaRow[]) {
      const dedupe = `pres:${row.id}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({
        key: `pp:${row.id}`,
        id: row.id,
        nombre: labelPartida(row),
        codigo_partida: row.codigo_partida,
        fuente: 'presupuesto',
        ci_presupuesto_partida_id: row.id,
        partida_id: null,
      });
    }
    return out;
  }

  const { data: cascada, error: cErr } = await supabase
    .from('partidas')
    .select('id, codigo, descripcion, capitulo_id')
    .eq('capitulo_id', capId)
    .order('codigo');

  if (cErr?.code === '42P01') {
    /* sin cascada */
  } else if (cErr) {
    throw new Error(cErr.message);
  } else {
    for (const p of cascada ?? []) {
      const cod = String(p.codigo ?? '').trim();
      const desc = String(p.descripcion ?? '').trim();
      const nombre = [cod, desc].filter(Boolean).join(' — ') || String(p.id).slice(0, 8);
      const dedupe = `cas:${p.id}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({
        key: `pd:${p.id}`,
        id: String(p.id),
        nombre,
        codigo_partida: cod,
        fuente: 'cascada',
        ci_presupuesto_partida_id: null,
        partida_id: String(p.id),
      });
    }
  }

  const { data: capRow } = await supabase
    .from('capitulos')
    .select('codigo')
    .eq('id', capId)
    .maybeSingle();

  const codCap = String(capRow?.codigo ?? '').trim();
  if (codCap) {
    const { data: pres, error: pErr } = await supabase
      .from('ci_presupuesto_partidas')
      .select('id,codigo_partida,descripcion,proyecto_id,capitulo_codigo')
      .eq('proyecto_id', pid)
      .eq('capitulo_codigo', codCap)
      .order('codigo_partida');

    if (!pErr?.code || pErr.code !== '42P01') {
      if (pErr) throw new Error(pErr.message);
      for (const row of (pres ?? []) as PartidaRow[]) {
        const dedupe = `pres:${row.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        out.push({
          key: `pp:${row.id}`,
          id: row.id,
          nombre: labelPartida(row),
          codigo_partida: row.codigo_partida,
          fuente: 'presupuesto',
          ci_presupuesto_partida_id: row.id,
          partida_id: null,
        });
      }
    }
  }

  out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return out;
}

/** Primera partida del capítulo (para imputación cuando la partida es opcional). */
export async function primeraPartidaCapituloDespacho(
  supabase: SupabaseClient,
  proyectoId: string,
  capituloId: string,
): Promise<PartidaProyectoDespacho | null> {
  const partidas = await listarPartidasCapituloDespacho(supabase, proyectoId, capituloId);
  return partidas[0] ?? null;
}
