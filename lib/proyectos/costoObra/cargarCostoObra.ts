import type { SupabaseClient } from '@supabase/supabase-js';
import {
  esMigracionCostoObraPendiente,
  esObraDemo,
  payloadCostoObraVacio,
  REGLA_MANO_OBRA_COSTO,
  MIGRACION_COSTO_OBRA,
} from '@/lib/proyectos/costoObra/reglasCostoObra';
import type {
  CostoObraDetalleItem,
  CostoObraFuenteManoObra,
  CostoObraPayload,
} from '@/lib/proyectos/costoObra/tipos';

export { esMigracionCostoObraPendiente, MIGRACION_COSTO_OBRA, REGLA_MANO_OBRA_COSTO };

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function asDetalle(raw: unknown): CostoObraDetalleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      tipo: str(o.tipo, 'otro'),
      id: o.id as string | number | null | undefined,
      label: str(o.label, '—'),
      usd: Math.round(num(o.usd) * 100) / 100,
      empleado_id: o.empleado_id != null ? String(o.empleado_id) : null,
      fecha: o.fecha != null ? String(o.fecha) : null,
      desde: o.desde != null ? String(o.desde) : null,
      hasta: o.hasta != null ? String(o.hasta) : null,
      dias: o.dias != null ? num(o.dias) : null,
      costo_diario: o.costo_diario != null ? num(o.costo_diario) : null,
    };
  });
}

function fuenteMo(v: unknown): CostoObraFuenteManoObra {
  const s = str(v);
  if (s === 'nomina' || s === 'jornales' || s === 'mixto' || s === 'ninguna') return s;
  return 'ninguna';
}

export function normalizarCostoObra(raw: unknown, proyectoId: string): CostoObraPayload {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const partidas = o.partidas && typeof o.partidas === 'object' ? (o.partidas as Record<string, unknown>) : {};
  const mat = (partidas.materiales ?? {}) as Record<string, unknown>;
  const mo = (partidas.mano_obra ?? {}) as Record<string, unknown>;
  const herr = (partidas.herramientas ?? {}) as Record<string, unknown>;
  const otros = (partidas.otros ?? {}) as Record<string, unknown>;
  const ad = (o.honorarios_ad ?? {}) as Record<string, unknown>;

  const materialesUsd = Math.round(num(mat.usd) * 100) / 100;
  const manoObraUsd = Math.round(num(mo.usd) * 100) / 100;
  const herrUsd = Math.round(num(herr.usd) * 100) / 100;
  const otrosUsd = Math.round(num(otros.usd) * 100) / 100;
  const directo =
    o.total_directo_usd != null
      ? Math.round(num(o.total_directo_usd) * 100) / 100
      : Math.round((materialesUsd + manoObraUsd + herrUsd + otrosUsd) * 100) / 100;
  const honorariosUsd = Math.round(num(ad.usd) * 100) / 100;

  return {
    proyecto_id: str(o.proyecto_id, proyectoId),
    proyecto_nombre: str(o.proyecto_nombre, 'Obra'),
    excluido_demo: Boolean(o.excluido_demo),
    regla_mano_obra: str(o.regla_mano_obra, REGLA_MANO_OBRA_COSTO),
    tasa_bcv_ves_por_usd: num(o.tasa_bcv_ves_por_usd),
    partidas: {
      materiales: {
        usd: materialesUsd,
        compras_usd: Math.round(num(mat.compras_usd) * 100) / 100,
        egresos_ajenos_usd: Math.round(num(mat.egresos_ajenos_usd) * 100) / 100,
        detalle: asDetalle(mat.detalle),
      },
      mano_obra: {
        usd: manoObraUsd,
        fuente: fuenteMo(mo.fuente),
        nomina_usd: Math.round(num(mo.nomina_usd) * 100) / 100,
        jornales_usd: Math.round(num(mo.jornales_usd) * 100) / 100,
        detalle: asDetalle(mo.detalle),
      },
      herramientas: {
        usd: herrUsd,
        detalle: asDetalle(herr.detalle),
      },
      otros: {
        usd: otrosUsd,
        gastos_obra_usd: Math.round(num(otros.gastos_obra_usd) * 100) / 100,
        registros_gastos_usd: Math.round(num(otros.registros_gastos_usd) * 100) / 100,
        detalle: asDetalle(otros.detalle),
      },
    },
    honorarios_ad: {
      pct: num(ad.pct),
      usd: honorariosUsd,
      fuente: str(ad.fuente, 'default'),
    },
    total_directo_usd: directo,
    total_con_honorarios_ad_usd:
      o.total_con_honorarios_ad_usd != null
        ? Math.round(num(o.total_con_honorarios_ad_usd) * 100) / 100
        : Math.round((directo + honorariosUsd) * 100) / 100,
  };
}

export async function cargarCostoObra(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CostoObraPayload> {
  const id = proyectoId.trim();
  if (!id) throw new Error('Proyecto requerido');

  const { data, error } = await supabase.rpc('ci_costo_obra', { p_proyecto_id: id });
  if (error) {
    if (esMigracionCostoObraPendiente(error.message)) {
      throw new Error(`Aplique la migración ${MIGRACION_COSTO_OBRA} en Supabase.`);
    }
    throw new Error(error.message);
  }
  if (data == null) {
    const { data: proy } = await supabase.from('ci_proyectos').select('nombre').eq('id', id).maybeSingle();
    const nombre = String((proy as { nombre?: string } | null)?.nombre ?? 'Obra');
    if (esObraDemo(nombre)) {
      return payloadCostoObraVacio({ proyectoId: id, proyectoNombre: nombre, excluidoDemo: true });
    }
    throw new Error('No se pudo calcular el costo de la obra');
  }
  return normalizarCostoObra(data, id);
}
