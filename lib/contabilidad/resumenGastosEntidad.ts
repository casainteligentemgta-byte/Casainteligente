import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CLASIFICACIONES_GASTO_ENTIDAD,
  type ClasificacionGastoEntidad,
  etiquetaClasificacionGastoEntidad,
} from '@/lib/contabilidad/clasificacionGastoEntidad';

export type FilaGastoEntidad = {
  id: string;
  fecha: string;
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  entidad_id: string | null;
  clasificacion_gasto_entidad: ClasificacionGastoEntidad | null;
  monto_ves: number | null;
  monto_usd: number | null;
  total_amount: number;
  moneda_original: string | null;
};

export type TotalesClasificacionGastoEntidad = {
  clave: ClasificacionGastoEntidad | 'sin_clasificar';
  etiqueta: string;
  count: number;
  totalBs: number;
  totalUsd: number;
};

export type ResumenGastosEntidad = {
  filas: FilaGastoEntidad[];
  totalesPorClasificacion: TotalesClasificacionGastoEntidad[];
  totalBs: number;
  totalUsd: number;
  count: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function agruparTotalesGastosEntidad(filas: FilaGastoEntidad[]): TotalesClasificacionGastoEntidad[] {
  const map = new Map<string, TotalesClasificacionGastoEntidad>();

  const ensure = (clave: ClasificacionGastoEntidad | 'sin_clasificar') => {
    const key = clave;
    if (!map.has(key)) {
      map.set(key, {
        clave,
        etiqueta:
          clave === 'sin_clasificar' ? 'Sin clasificar' : etiquetaClasificacionGastoEntidad(clave),
        count: 0,
        totalBs: 0,
        totalUsd: 0,
      });
    }
    return map.get(key)!;
  };

  for (const cl of CLASIFICACIONES_GASTO_ENTIDAD) ensure(cl);
  ensure('sin_clasificar');

  for (const f of filas) {
    const clave = f.clasificacion_gasto_entidad ?? 'sin_clasificar';
    const bucket = ensure(clave);
    bucket.count += 1;
    bucket.totalBs += num(f.monto_ves ?? f.total_amount);
    bucket.totalUsd += num(f.monto_usd);
  }

  const orden: Array<ClasificacionGastoEntidad | 'sin_clasificar'> = [
    ...CLASIFICACIONES_GASTO_ENTIDAD,
    'sin_clasificar',
  ];
  return orden
    .map((k) => map.get(k)!)
    .filter((t) => t.count > 0 || t.clave === 'sin_clasificar');
}

export async function cargarResumenGastosEntidad(
  supabase: SupabaseClient,
  params: {
    entidadId?: string | null;
    fechaDesde: string;
    fechaHasta: string;
    limit?: number;
  },
): Promise<ResumenGastosEntidad> {
  let q = supabase
    .from('contabilidad_compras')
    .select(
      'id,fecha,invoice_number,supplier_name,supplier_rif,entidad_id,clasificacion_gasto_entidad,monto_ves,monto_usd,total_amount,moneda_original',
    )
    .eq('imputacion', 'entidad')
    .gte('fecha', params.fechaDesde)
    .lte('fecha', params.fechaHasta)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  const entidadId = params.entidadId?.trim();
  if (entidadId) q = q.eq('entidad_id', entidadId);

  const limit = params.limit ?? 500;
  const { data, error } = await q.limit(limit);
  if (error) throw error;

  const filas = (data ?? []) as FilaGastoEntidad[];
  const totalesPorClasificacion = agruparTotalesGastosEntidad(filas);
  const totalBs = filas.reduce((s, f) => s + num(f.monto_ves ?? f.total_amount), 0);
  const totalUsd = filas.reduce((s, f) => s + num(f.monto_usd), 0);

  return {
    filas,
    totalesPorClasificacion,
    totalBs,
    totalUsd,
    count: filas.length,
  };
}
