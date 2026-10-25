import type { SupabaseClient } from '@supabase/supabase-js';

export type FilaCadenaProcura = {
  id: string;
  ticket: string;
  proyectoId: string | null;
  proyectoNombre: string;
  material: string;
  unidad: string;
  cantidadPedida: number;
  cantidadCompra: number | null;
  estado: string;
  tieneFactura: boolean;
  purchaseInvoiceId: string | null;
  createdAt: string | null;
  cumplimientoPct: number | null;
};

export type ResumenCadenaProcura = {
  total: number;
  conFactura: number;
  sinFactura: number;
  cumplimientoPromedioPct: number | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Cadena procura → cantidad de compra → factura vinculada. */
export async function cargarInformeCadenaProcura(
  supabase: SupabaseClient,
  opts?: { proyectoId?: string | null; limite?: number },
): Promise<{ filas: FilaCadenaProcura[]; resumen: ResumenCadenaProcura }> {
  const limite = Math.min(Math.max(opts?.limite ?? 400, 50), 1000);
  let q = supabase
    .from('ci_procuras')
    .select(
      'id,ticket,proyecto_id,material_txt,unidad,cantidad,cantidad_compra,estado,purchase_invoice_id,created_at',
    )
    .neq('estado', 'cancelada')
    .order('created_at', { ascending: false })
    .limit(limite);

  const pid = opts?.proyectoId?.trim();
  if (pid) q = q.eq('proyecto_id', pid);

  const { data, error } = await q;
  if (error?.code === '42P01') {
    throw new Error('Tabla ci_procuras no disponible.');
  }
  if (error) {
    // columna cantidad_compra puede faltar en bases viejas
    if (/cantidad_compra/i.test(error.message)) {
      const fallback = await supabase
        .from('ci_procuras')
        .select('id,ticket,proyecto_id,material_txt,unidad,cantidad,estado,purchase_invoice_id,created_at')
        .neq('estado', 'cancelada')
        .order('created_at', { ascending: false })
        .limit(limite);
      if (fallback.error) throw new Error(fallback.error.message);
      return normalizar(
        (fallback.data ?? []).map((r) => ({ ...r, cantidad_compra: null })),
        supabase,
      );
    }
    throw new Error(error.message);
  }

  return normalizar((data ?? []) as Array<Record<string, unknown>>, supabase);
}

async function normalizar(
  rows: Array<Record<string, unknown>>,
  supabase: SupabaseClient,
): Promise<{ filas: FilaCadenaProcura[]; resumen: ResumenCadenaProcura }> {
  const proyectoIds = Array.from(
    new Set(
      rows
        .map((r) => (r.proyecto_id != null ? String(r.proyecto_id) : ''))
        .filter(Boolean),
    ),
  );
  const nombrePorId = new Map<string, string>();
  if (proyectoIds.length) {
    const { data: proyectos } = await supabase
      .from('ci_proyectos')
      .select('id,nombre')
      .in('id', proyectoIds);
    for (const p of proyectos ?? []) {
      nombrePorId.set(String(p.id), String(p.nombre ?? 'Obra').trim() || 'Obra');
    }
  }

  const filas: FilaCadenaProcura[] = rows.map((r) => {
    const pedida = num(r.cantidad);
    const compraRaw = r.cantidad_compra;
    const cantidadCompra =
      compraRaw == null || compraRaw === '' ? null : num(compraRaw);
    const cumplimientoPct =
      pedida > 0 && cantidadCompra != null
        ? Math.round((cantidadCompra / pedida) * 1000) / 10
        : null;
    const proyectoId = r.proyecto_id != null ? String(r.proyecto_id) : null;
    return {
      id: String(r.id),
      ticket: String(r.ticket ?? '').trim() || '—',
      proyectoId,
      proyectoNombre: proyectoId ? nombrePorId.get(proyectoId) ?? 'Obra' : 'Sin obra',
      material: String(r.material_txt ?? '').trim() || 'Material',
      unidad: String(r.unidad ?? 'UND').trim() || 'UND',
      cantidadPedida: pedida,
      cantidadCompra,
      estado: String(r.estado ?? '').trim() || '—',
      purchaseInvoiceId: r.purchase_invoice_id != null ? String(r.purchase_invoice_id) : null,
      tieneFactura: Boolean(r.purchase_invoice_id),
      createdAt: r.created_at != null ? String(r.created_at) : null,
      cumplimientoPct,
    };
  });

  const conFactura = filas.filter((f) => f.tieneFactura).length;
  const conCumpl = filas.filter((f) => f.cumplimientoPct != null);
  const cumplimientoPromedioPct =
    conCumpl.length > 0
      ? Math.round(
          (conCumpl.reduce((s, f) => s + (f.cumplimientoPct ?? 0), 0) / conCumpl.length) * 10,
        ) / 10
      : null;

  return {
    filas,
    resumen: {
      total: filas.length,
      conFactura,
      sinFactura: filas.length - conFactura,
      cumplimientoPromedioPct,
    },
  };
}
