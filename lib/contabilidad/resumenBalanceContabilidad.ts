import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';

export type FilaEgresoObra = {
  proyecto_id: string;
  proyecto_nombre: string;
  total_usd: number;
  total_bs: number;
  count: number;
};

export type FilaIngresoEntidad = {
  entidad_id: string;
  entidad_nombre: string;
  total_usd: number;
  total_bs: number;
  count: number;
};

export type ResumenBalanceContabilidad = {
  fechaDesde: string;
  fechaHasta: string;
  totalIngresosUsd: number;
  totalIngresosBs: number;
  totalEgresosUsd: number;
  totalEgresosBs: number;
  balanceUsd: number;
  balanceBs: number;
  ingresosPorEntidad: FilaIngresoEntidad[];
  egresosPorObra: FilaEgresoObra[];
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function rangoMesActual(): { desde: string; hasta: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const ultimo = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    desde: `${y}-${m}-01`,
    hasta: `${y}-${m}-${String(ultimo).padStart(2, '0')}`,
  };
}

export async function cargarResumenBalanceContabilidad(
  supabase: SupabaseClient,
  params?: { fechaDesde?: string; fechaHasta?: string },
): Promise<ResumenBalanceContabilidad> {
  const rango = rangoMesActual();
  const fechaDesde = (params?.fechaDesde ?? rango.desde).slice(0, 10);
  const fechaHasta = (params?.fechaHasta ?? rango.hasta).slice(0, 10);

  const { data: compras, error: cErr } = await supabase
    .from('contabilidad_compras')
    .select('id,proyecto_id,monto_usd,monto_ves,total_amount,imputacion')
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)
    .not('proyecto_id', 'is', null)
    .neq('imputacion', IMPUTACION_ENTIDAD)
    .limit(5000);

  if (cErr) throw cErr;

  const egresosMap = new Map<string, FilaEgresoObra>();
  for (const row of compras ?? []) {
    const proyectoId = String((row as { proyecto_id?: string }).proyecto_id ?? '').trim();
    if (!proyectoId) continue;
    const usd = num((row as { monto_usd?: number }).monto_usd);
    const bs = num(
      (row as { monto_ves?: number }).monto_ves ??
        (row as { total_amount?: number }).total_amount,
    );
    const prev = egresosMap.get(proyectoId) ?? {
      proyecto_id: proyectoId,
      proyecto_nombre: '',
      total_usd: 0,
      total_bs: 0,
      count: 0,
    };
    prev.total_usd += usd;
    prev.total_bs += bs;
    prev.count += 1;
    egresosMap.set(proyectoId, prev);
  }

  const proyectoIds = Array.from(egresosMap.keys());
  if (proyectoIds.length) {
    const { data: proyectos } = await supabase
      .from('ci_proyectos')
      .select('id,nombre')
      .in('id', proyectoIds.slice(0, 200));
    for (const p of proyectos ?? []) {
      const id = String((p as { id: string }).id);
      const fila = egresosMap.get(id);
      if (fila) fila.proyecto_nombre = String((p as { nombre?: string }).nombre ?? 'Obra').trim();
    }
  }

  const egresosPorObra = Array.from(egresosMap.values())
    .map((f) => ({
      ...f,
      proyecto_nombre: f.proyecto_nombre || 'Obra sin nombre',
    }))
    .sort((a, b) => b.total_usd - a.total_usd);

  const { data: abonos, error: aErr } = await supabase
    .from('ci_proyecto_abonos')
    .select('id,proyecto_id,monto_usd,monto_recibido,moneda,fecha_abono')
    .gte('fecha_abono', fechaDesde)
    .lte('fecha_abono', fechaHasta)
    .limit(5000);

  if (aErr) throw aErr;

  const proyectoIdsAbonos = Array.from(
    new Set(
      (abonos ?? [])
        .map((a) => String((a as { proyecto_id?: string }).proyecto_id ?? '').trim())
        .filter(Boolean),
    ),
  );

  const proyectoEntidad = new Map<string, { nombre: string; entidad_id: string | null }>();
  if (proyectoIdsAbonos.length) {
    const { data: proyRows } = await supabase
      .from('ci_proyectos')
      .select('id,nombre,entidad_id')
      .in('id', proyectoIdsAbonos.slice(0, 200));
    for (const p of proyRows ?? []) {
      const id = String((p as { id: string }).id);
      proyectoEntidad.set(id, {
        nombre: String((p as { nombre?: string }).nombre ?? '').trim(),
        entidad_id: (p as { entidad_id?: string | null }).entidad_id ?? null,
      });
    }
  }

  const ingresosMap = new Map<string, FilaIngresoEntidad>();
  for (const row of abonos ?? []) {
    const proyectoId = String((row as { proyecto_id?: string }).proyecto_id ?? '').trim();
    const meta = proyectoEntidad.get(proyectoId);
    const entidadId = meta?.entidad_id?.trim() || 'sin_entidad';
    const usd = num((row as { monto_usd?: number }).monto_usd);
    const moneda = String((row as { moneda?: string }).moneda ?? 'USD').toUpperCase();
    const recibido = num((row as { monto_recibido?: number }).monto_recibido);
    const bs = moneda === 'VES' ? recibido : 0;

    const prev = ingresosMap.get(entidadId) ?? {
      entidad_id: entidadId,
      entidad_nombre: entidadId === 'sin_entidad' ? 'Sin entidad' : '',
      total_usd: 0,
      total_bs: 0,
      count: 0,
    };
    prev.total_usd += usd;
    prev.total_bs += bs;
    prev.count += 1;
    ingresosMap.set(entidadId, prev);
  }

  const entidadIds = Array.from(ingresosMap.keys()).filter((id) => id !== 'sin_entidad');
  if (entidadIds.length) {
    const { data: entRows } = await supabase
      .from('ci_entidades')
      .select('id,nombre')
      .in('id', entidadIds.slice(0, 100));
    for (const e of entRows ?? []) {
      const id = String((e as { id: string }).id);
      const fila = ingresosMap.get(id);
      if (fila) fila.entidad_nombre = String((e as { nombre?: string }).nombre ?? 'Entidad').trim();
    }
  }

  const ingresosPorEntidad = Array.from(ingresosMap.values())
    .map((f) => ({
      ...f,
      entidad_nombre: f.entidad_nombre || (f.entidad_id === 'sin_entidad' ? 'Sin entidad' : 'Entidad'),
    }))
    .sort((a, b) => b.total_usd - a.total_usd);

  const totalIngresosUsd = ingresosPorEntidad.reduce((s, f) => s + f.total_usd, 0);
  const totalIngresosBs = ingresosPorEntidad.reduce((s, f) => s + f.total_bs, 0);
  const totalEgresosUsd = egresosPorObra.reduce((s, f) => s + f.total_usd, 0);
  const totalEgresosBs = egresosPorObra.reduce((s, f) => s + f.total_bs, 0);

  return {
    fechaDesde,
    fechaHasta,
    totalIngresosUsd,
    totalIngresosBs,
    totalEgresosUsd,
    totalEgresosBs,
    balanceUsd: totalIngresosUsd - totalEgresosUsd,
    balanceBs: totalIngresosBs - totalEgresosBs,
    ingresosPorEntidad,
    egresosPorObra,
  };
}
