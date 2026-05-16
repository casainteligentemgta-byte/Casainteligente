import type { SupabaseClient } from '@supabase/supabase-js';
import { idsObrasHijasDesdeModuloIntegral } from '@/lib/proyectos/obraHijasDesdeModulo';

export type ResumenOficioFila = {
  codigo: string;
  nombre: string | null;
  plazas: number;
  solicitudes: number;
};

export type ResumenSolicitadosPayload = {
  alcanceNombre: string;
  generadoAt: string;
  filas: ResumenOficioFila[];
  totalPlazas: number;
  totalSolicitudes: number;
  solicitudesPendientes: number;
};

type LaborRequestRow = {
  id: string;
  project_id: string;
  specialty_codigo: string;
  specialty_nombre: string | null;
  quantity_requested: number;
  created_at: string;
};

function agregarFilasResumen(pending: LaborRequestRow[]): ResumenOficioFila[] {
  const map = new Map<string, ResumenOficioFila>();
  for (const r of pending) {
    const cod = r.specialty_codigo.trim() || '—';
    const cur = map.get(cod) ?? {
      codigo: cod,
      nombre: r.specialty_nombre,
      plazas: 0,
      solicitudes: 0,
    };
    cur.plazas += Math.max(0, r.quantity_requested);
    cur.solicitudes += 1;
    map.set(cod, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
}

/** Carga solicitudes pending y resumen por oficio para un módulo integral u obra. */
export async function loadResumenSolicitadosOficios(
  supabase: SupabaseClient,
  opts: { proyectoModuloId?: string; proyectoObraId?: string },
): Promise<ResumenSolicitadosPayload | { error: string }> {
  const pm = (opts.proyectoModuloId ?? '').trim();
  const po = (opts.proyectoObraId ?? '').trim();
  if (!pm && !po) {
    return { error: 'Indique proyecto_modulo o proyecto' };
  }

  let scope: string[] | null = null;
  let alcanceNombre = 'Proyecto';

  if (pm) {
    const hijas = await idsObrasHijasDesdeModuloIntegral(supabase, pm);
    scope = Array.from(new Set([pm, ...hijas]));
    const { data: nom } = await supabase.from('ci_proyectos').select('nombre').eq('id', pm).maybeSingle();
    alcanceNombre = ((nom as { nombre?: string | null } | null)?.nombre ?? '').trim() || alcanceNombre;
  } else {
    scope = [po];
    const { data: nom } = await supabase.from('ci_proyectos').select('nombre').eq('id', po).maybeSingle();
    alcanceNombre = ((nom as { nombre?: string | null } | null)?.nombre ?? '').trim() || alcanceNombre;
  }

  let q = supabase
    .from('labor_requests')
    .select('id,project_id,specialty_codigo,specialty_nombre,quantity_requested,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (scope != null && scope.length > 0) {
    q = q.in('project_id', scope);
  }
  const { data, error } = await q;
  if (error) {
    const m = (error.message ?? '').toLowerCase();
    if (m.includes('labor_requests')) {
      return { error: 'Tabla labor_requests no disponible' };
    }
    return { error: error.message };
  }

  const pending = (data ?? []) as LaborRequestRow[];
  const filas = agregarFilasResumen(pending);
  const totalPlazas = pending.reduce((a, r) => a + Math.max(0, r.quantity_requested), 0);

  return {
    alcanceNombre,
    generadoAt: new Date().toISOString(),
    filas,
    totalPlazas,
    totalSolicitudes: pending.length,
    solicitudesPendientes: pending.length,
  };
}
