import type { SupabaseClient } from '@supabase/supabase-js';

type ContratoRowRef = {
  id: string;
  obra_id?: string | null;
  proyecto_id?: string | null;
  fecha_ingreso?: string | null;
  fecha_firma_contrato?: string | null;
};

function anioDesdeContratoRow(r: ContratoRowRef): number {
  const iso = (r.fecha_firma_contrato ?? r.fecha_ingreso ?? '').trim();
  if (iso.length >= 4) {
    const y = Number(iso.slice(0, 4));
    if (Number.isFinite(y) && y >= 1990 && y <= 2100) return y;
  }
  return new Date().getFullYear();
}

function tiempoOrdenContrato(r: ContratoRowRef): number {
  const iso = (r.fecha_firma_contrato ?? r.fecha_ingreso ?? '').trim();
  if (iso) {
    const t = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** Referencia tipo AÑO-NNNN según contratos del empleado en la obra/proyecto vinculada. */
export async function construirExpedienteRefPorEmpleado(supabase: SupabaseClient, empleadoId: string): Promise<string> {
  const nowYear = new Date().getFullYear();
  const { data: ctr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,obra_id,proyecto_id,fecha_ingreso,fecha_firma_contrato')
    .eq('empleado_id', empleadoId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const c = ctr as ContratoRowRef | null;
  if (!c) return `${nowYear}-0001`;

  const sitioId = String(c.obra_id ?? c.proyecto_id ?? '').trim();
  const year = anioDesdeContratoRow(c);
  if (!sitioId || !Number.isFinite(year)) return `${nowYear}-0001`;

  const { data: rows } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,fecha_ingreso,fecha_firma_contrato')
    .or(`obra_id.eq.${sitioId},proyecto_id.eq.${sitioId}`);

  const sameYear = ((rows ?? []) as ContratoRowRef[])
    .filter((r) => anioDesdeContratoRow(r) === year)
    .sort((a, b) => tiempoOrdenContrato(a) - tiempoOrdenContrato(b) || String(a.id).localeCompare(String(b.id)));

  const idx = sameYear.findIndex((r) => String(r.id ?? '') === c.id);
  const seq = String(idx >= 0 ? idx + 1 : sameYear.length || 1).padStart(4, '0');
  return `${year}-${seq}`;
}
