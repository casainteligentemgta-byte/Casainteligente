import type { SupabaseClient } from '@supabase/supabase-js';
import {
  codigosDesdeNombresExpediente,
  formatearExpedienteContrato,
} from '@/lib/talento/nomenclaturaExpedienteContrato';

type ContratoRowRef = {
  id: string;
  obra_id?: string | null;
  proyecto_id?: string | null;
  fecha_ingreso?: string | null;
  fecha_firma_contrato?: string | null;
  created_at?: string | null;
};

function partesFechaDesdeContrato(r: ContratoRowRef): { anio: number; mes: number; t: number } {
  const iso = (r.fecha_firma_contrato ?? r.fecha_ingreso ?? r.created_at ?? '').trim();
  if (iso) {
    const day = iso.includes('T') ? iso.slice(0, 10) : iso.slice(0, 10);
    if (/^\d{4}-\d{2}/.test(day)) {
      const anio = Number(day.slice(0, 4));
      const mes = Number(day.slice(5, 7));
      const t = new Date(iso.includes('T') ? iso : `${day}T12:00:00`).getTime();
      if (Number.isFinite(anio) && mes >= 1 && mes <= 12) {
        return { anio, mes, t: Number.isNaN(t) ? 0 : t };
      }
    }
  }
  const d = new Date();
  return { anio: d.getFullYear(), mes: d.getMonth() + 1, t: 0 };
}

/**
 * Expediente contrato individual: AÑO-MES-ENTIDAD-OBRA-Número (sin prefijo EXPRESS).
 */
export async function construirExpedienteRefPorEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<string> {
  const now = new Date();
  const { data: ctr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('id,obra_id,proyecto_id,fecha_ingreso,fecha_firma_contrato,created_at')
    .eq('empleado_id', empleadoId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const c = ctr as ContratoRowRef | null;
  if (!c) {
    return formatearExpedienteContrato({
      anio: now.getFullYear(),
      mes: now.getMonth() + 1,
      entidadCodigo: 'XXX',
      obraCodigo: 'XXX',
      numero: 1,
    });
  }

  const sitioId = String(c.obra_id ?? c.proyecto_id ?? '').trim();
  const { anio, mes } = partesFechaDesdeContrato(c);

  let obraCodigoFuente = '';
  let entidadId: string | null = null;
  if (sitioId) {
    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('nombre,obra_codigo,entidad_id')
      .eq('id', sitioId)
      .maybeSingle();
    const p = proy as {
      nombre?: string | null;
      obra_codigo?: string | null;
      entidad_id?: string | null;
    } | null;
    obraCodigoFuente = (p?.obra_codigo ?? '').trim() || (p?.nombre ?? '').trim();
    entidadId = (p?.entidad_id ?? '').trim() || null;
  }

  let entidadNombre = '';
  if (entidadId) {
    for (const sel of ['nombre,nombre_comercial,nombre_legal', 'nombre,nombre_comercial', 'nombre'] as const) {
      const { data: ent, error } = await supabase
        .from('ci_entidades')
        .select(sel)
        .eq('id', entidadId)
        .maybeSingle();
      if (error && /column|42703|schema cache/i.test(error.message)) continue;
      const e = ent as {
        nombre?: string | null;
        nombre_comercial?: string | null;
        nombre_legal?: string | null;
      } | null;
      entidadNombre =
        (e?.nombre ?? '').trim() ||
        (e?.nombre_comercial ?? '').trim() ||
        (e?.nombre_legal ?? '').trim();
      if (entidadNombre) break;
    }
  }

  let numero = 1;
  if (sitioId) {
    const { data: rows } = await supabase
      .from('ci_contratos_empleado_obra')
      .select('id,fecha_ingreso,fecha_firma_contrato,created_at')
      .or(`obra_id.eq.${sitioId},proyecto_id.eq.${sitioId}`);

    const same = ((rows ?? []) as ContratoRowRef[])
      .map((r) => ({ r, p: partesFechaDesdeContrato(r) }))
      .filter((x) => x.p.anio === anio && x.p.mes === mes)
      .sort((a, b) => a.p.t - b.p.t || String(a.r.id).localeCompare(String(b.r.id)));

    const idx = same.findIndex((x) => String(x.r.id ?? '') === c.id);
    numero = idx >= 0 ? idx + 1 : same.length || 1;
  }

  const { entidadCodigo, obraCodigo } = codigosDesdeNombresExpediente({
    entidadNombre,
    obraCodigoFuente,
  });
  return formatearExpedienteContrato({
    anio,
    mes,
    entidadCodigo,
    obraCodigo,
    numero,
  });
}
