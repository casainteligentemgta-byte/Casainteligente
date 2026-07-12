import type { SupabaseClient } from '@supabase/supabase-js';
import { labelPartida, type PartidaRow } from '@/lib/almacen/inventoryClasificacion';

export type PartidaProyectoDespacho = {
  /** Valor para el selector: `pp:uuid` o `pd:uuid`. */
  key: string;
  id: string;
  nombre: string;
  codigo_partida: string;
  fuente: 'presupuesto' | 'cascada';
  ci_presupuesto_partida_id: string | null;
  partida_id: string | null;
};

export async function listarPartidasProyectoDespacho(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<PartidaProyectoDespacho[]> {
  const out: PartidaProyectoDespacho[] = [];
  const seen = new Set<string>();

  const { data: pres, error: pErr } = await supabase
    .from('ci_presupuesto_partidas')
    .select('id,codigo_partida,descripcion,proyecto_id')
    .eq('proyecto_id', proyectoId)
    .order('codigo_partida');

  if (pErr && pErr.code !== '42P01') throw new Error(pErr.message);

  for (const row of (pres ?? []) as PartidaRow[]) {
    const label = labelPartida(row);
    const dedupe = `pres:${row.id}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      key: `pp:${row.id}`,
      id: row.id,
      nombre: label,
      codigo_partida: row.codigo_partida,
      fuente: 'presupuesto',
      ci_presupuesto_partida_id: row.id,
      partida_id: null,
    });
  }

  const selectBasico =
    'id, codigo, descripcion, capitulo_id, capitulos!inner(proyecto_id, codigo, nombre)';
  let { data: cascada, error: cErr } = await supabase
    .from('partidas')
    .select(selectBasico)
    .eq('capitulos.proyecto_id', proyectoId)
    .order('codigo');

  if (cErr?.code === '42P01') return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (cErr) throw new Error(cErr.message);

  for (const raw of cascada ?? []) {
    const p = raw as {
      id: string;
      codigo?: string;
      descripcion?: string;
      capitulos?: { codigo?: string; nombre?: string } | Array<{
        codigo?: string;
        nombre?: string;
      }>;
    };
    const capRaw = p.capitulos;
    const cap = Array.isArray(capRaw) ? capRaw[0] : capRaw;
    const cod = String(p.codigo ?? '').trim();
    const desc = String(p.descripcion ?? '').trim();
    const capCod = String(cap?.codigo ?? '').trim();
    const capNom = String(cap?.nombre ?? '').trim();
    const capLabel =
      capCod || capNom
        ? `Cap. ${[capCod, capNom].filter(Boolean).join(' — ')}`
        : '';
    const nombre = [cod, desc].filter(Boolean).join(' — ') || p.id.slice(0, 8);
    const label = capLabel ? `${capLabel} · ${nombre}` : nombre;
    const dedupe = `cas:${p.id}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      key: `pd:${p.id}`,
      id: p.id,
      nombre: label,
      codigo_partida: cod,
      fuente: 'cascada',
      ci_presupuesto_partida_id: null,
      partida_id: p.id,
    });
  }

  out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return out;
}
