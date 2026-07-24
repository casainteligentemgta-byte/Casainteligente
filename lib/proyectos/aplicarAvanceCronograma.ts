import type { SupabaseClient } from '@supabase/supabase-js';

export type ActualizacionAvanceCronograma = {
  id?: string;
  partida_id?: string | null;
  codigo_partida?: string | null;
  nombre_tarea?: string;
  porcentaje_avance: number;
  fecha_inicio_planificada?: string;
  fecha_fin_planificada?: string;
  orden?: number;
};

function esUuidValido(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function fechasPorDefecto(): { inicio: string; fin: string } {
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  const fin = new Date(hoy);
  fin.setDate(fin.getDate() + 14);
  return {
    inicio: hoy.toISOString().slice(0, 10),
    fin: fin.toISOString().slice(0, 10),
  };
}

/** Aplica avance sobre cronograma_tareas (anti-embudo: inserta si no hay tarea). */
export async function aplicarAvanceCronograma(
  supabase: SupabaseClient,
  proyectoId: string,
  actualizaciones: ActualizacionAvanceCronograma[],
): Promise<number> {
  let guardados = 0;

  for (const act of actualizaciones) {
    const pct = Math.min(100, Math.max(0, Number(act.porcentaje_avance) || 0));
    const partidaId = act.partida_id?.trim() || null;
    const tareaId = act.id?.trim();
    const fechasDef = fechasPorDefecto();
    const inicio = act.fecha_inicio_planificada?.slice(0, 10) || fechasDef.inicio;
    const fin = act.fecha_fin_planificada?.slice(0, 10) || fechasDef.fin;

    if (tareaId && esUuidValido(tareaId)) {
      const { error } = await supabase
        .from('cronograma_tareas')
        .update({ porcentaje_avance: pct, updated_at: new Date().toISOString() })
        .eq('id', tareaId)
        .eq('proyecto_id', proyectoId);
      if (error) throw error;
      guardados += 1;
      continue;
    }

    if (partidaId) {
      const { data: existente } = await supabase
        .from('cronograma_tareas')
        .select('id')
        .eq('proyecto_id', proyectoId)
        .eq('partida_id', partidaId)
        .order('orden', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existente?.id) {
        const { error } = await supabase
          .from('cronograma_tareas')
          .update({ porcentaje_avance: pct, updated_at: new Date().toISOString() })
          .eq('id', existente.id);
        if (error) throw error;
        guardados += 1;
        continue;
      }
    }

    const nombre =
      act.nombre_tarea?.trim() ||
      act.codigo_partida?.trim() ||
      'Partida sin nombre';

    const { error: insertErr } = await supabase.from('cronograma_tareas').insert({
      proyecto_id: proyectoId,
      partida_id: partidaId,
      codigo_partida: act.codigo_partida?.trim() || null,
      nombre_tarea: nombre,
      fecha_inicio_planificada: inicio,
      fecha_fin_planificada: fin >= inicio ? fin : inicio,
      porcentaje_avance: pct,
      orden: Number(act.orden) || 0,
    });
    if (insertErr) throw insertErr;
    guardados += 1;
  }

  return guardados;
}
