import type { SupabaseClient } from '@supabase/supabase-js';

export type CcoAuditoriaEvento = {
  id: string;
  proyecto_id: string | null;
  fecha: string;
  accion: string;
  detalle: string | null;
  actor: string | null;
  origen_v4_id: number | null;
  metadata: Record<string, unknown>;
};

export async function cargarAuditoriaCco(
  supabase: SupabaseClient,
  opts: { proyectoId?: string | null; limit?: number; q?: string | null },
): Promise<{ eventos: CcoAuditoriaEvento[]; total: number }> {
  const limit = Math.min(opts.limit ?? 300, 1000);
  let q = supabase
    .from('cco_auditoria_eventos')
    .select('id,proyecto_id,fecha,accion,detalle,actor,origen_v4_id,metadata,created_at')
    .order('fecha', { ascending: false })
    .limit(limit);

  if (opts.proyectoId) {
    q = q.eq('proyecto_id', opts.proyectoId);
  }

  const { data, error } = await q;
  if (error) throw error;

  const needle = String(opts.q ?? '')
    .trim()
    .toLowerCase();

  let eventos: CcoAuditoriaEvento[] = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      proyecto_id: r.proyecto_id != null ? String(r.proyecto_id) : null,
      fecha: String(r.fecha ?? r.created_at ?? '').slice(0, 19).replace('T', ' '),
      accion: String(r.accion ?? ''),
      detalle: r.detalle != null ? String(r.detalle) : null,
      actor: r.actor != null ? String(r.actor) : null,
      origen_v4_id: r.origen_v4_id != null ? Number(r.origen_v4_id) : null,
      metadata:
        r.metadata && typeof r.metadata === 'object'
          ? (r.metadata as Record<string, unknown>)
          : {},
    };
  });

  if (needle) {
    eventos = eventos.filter(
      (e) =>
        e.accion.toLowerCase().includes(needle) ||
        (e.detalle ?? '').toLowerCase().includes(needle) ||
        (e.actor ?? '').toLowerCase().includes(needle),
    );
  }

  return { eventos, total: eventos.length };
}
