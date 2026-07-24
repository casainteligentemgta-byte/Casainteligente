import type { SupabaseClient } from '@supabase/supabase-js';
import { listarCapitulosObra } from '@/lib/almacen/capitulosObra';
import { nombreCapituloLulo } from '@/lib/proyectos/presupuestoCapitulosFormat';

export type CapituloDespachoOption = {
  /** UUID en `capitulos` o clave virtual `pres:CODIGO` desde presupuesto Lulo nativo. */
  id: string;
  codigo: string;
  nombre: string;
  fuente: 'cascada' | 'presupuesto';
};

export async function listarCapitulosDespacho(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CapituloDespachoOption[]> {
  const pid = proyectoId.trim();
  const out: CapituloDespachoOption[] = [];
  const seen = new Set<string>();

  try {
    const cascada = await listarCapitulosObra(supabase, pid, 80);
    for (const c of cascada) {
      const key = `cas:${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        fuente: 'cascada',
      });
    }
  } catch {
    /* tabla capitulos puede no existir */
  }

  const { data: pres, error: pErr } = await supabase
    .from('ci_presupuesto_partidas')
    .select('capitulo_codigo, capitulo_descripcion, capitulo_orden')
    .eq('proyecto_id', pid)
    .order('capitulo_orden', { ascending: true })
    .limit(2000);

  if (pErr?.code === '42P01') {
    return out.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }
  if (pErr) throw new Error(pErr.message);

  for (const row of pres ?? []) {
    const cod = String(row.capitulo_codigo ?? '').trim();
    const desc = String(row.capitulo_descripcion ?? '').trim();
    const orden = Number(row.capitulo_orden ?? 9999);
    const codNorm = cod || String(orden > 0 && orden < 9999 ? orden : '');
    if (!codNorm) continue;

    const yaCascada = out.some(
      (c) => c.codigo.replace(/^0+/, '') === codNorm.replace(/^0+/, ''),
    );
    if (yaCascada) continue;

    const id = `pres:${codNorm}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      codigo: codNorm,
      nombre: nombreCapituloLulo(desc, codNorm),
      fuente: 'presupuesto',
    });
  }

  out.sort((a, b) => {
    const na = parseInt(a.codigo.replace(/\D/g, ''), 10);
    const nb = parseInt(b.codigo.replace(/\D/g, ''), 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.codigo.localeCompare(b.codigo, 'es', { numeric: true });
  });

  return out;
}
