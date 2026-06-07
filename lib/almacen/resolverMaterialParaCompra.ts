import type { SupabaseClient } from '@supabase/supabase-js';
import { normSkuCodigo } from '@/lib/almacen/resolverMaterialIdPorSku';

export type MaterialCompraResuelto = {
  id: string;
  matchedBy: 'sku' | 'nombre';
  name: string;
  category_id?: string | null;
};

function normalizarNombre(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Busca material existente por SKU (sap_code) o nombre exacto antes de crear duplicado.
 */
export async function resolverMaterialParaLineaCompra(
  supabase: SupabaseClient,
  opts: {
    item_code?: string;
    description: string;
    proyectoId?: string;
  },
): Promise<MaterialCompraResuelto | null> {
  const sku = normSkuCodigo(opts.item_code ?? '');
  if (sku) {
    const { data: rows, error } = await supabase
      .from('global_inventory')
      .select('id, sap_code, name, category_id')
      .not('sap_code', 'is', null);
    if (error) throw new Error(error.message);
    for (const row of rows ?? []) {
      if (normSkuCodigo(String(row.sap_code ?? '')) === sku) {
        return {
          id: String(row.id),
          matchedBy: 'sku',
          name: String(row.name ?? opts.description),
          category_id: row.category_id ? String(row.category_id) : null,
        };
      }
    }
  }

  const nombre = normalizarNombre(opts.description);
  if (nombre.length < 3) return null;

  let q = supabase.from('global_inventory').select('id, name, proyecto_id, category_id');
  if (opts.proyectoId) {
    q = q.eq('proyecto_id', opts.proyectoId);
  }
  const { data: candidatos, error: nameErr } = await q.limit(200);
  if (nameErr) throw new Error(nameErr.message);

  for (const row of candidatos ?? []) {
    if (normalizarNombre(String(row.name ?? '')) === nombre) {
      return {
        id: String(row.id),
        matchedBy: 'nombre',
        name: String(row.name),
        category_id: row.category_id ? String(row.category_id) : null,
      };
    }
  }

  if (opts.proyectoId) {
    const { data: globalRows, error: globalErr } = await supabase
      .from('global_inventory')
      .select('id, name, category_id')
      .is('proyecto_id', null)
      .limit(300);
    if (globalErr) throw new Error(globalErr.message);
    for (const row of globalRows ?? []) {
      if (normalizarNombre(String(row.name ?? '')) === nombre) {
        return {
          id: String(row.id),
          matchedBy: 'nombre',
          name: String(row.name),
          category_id: row.category_id ? String(row.category_id) : null,
        };
      }
    }
  }

  return null;
}

/** Actualiza costos y asignación de material existente al registrar compra. */
export async function actualizarMaterialExistenteCompra(
  supabase: SupabaseClient,
  materialId: string,
  opts: {
    unitPrice: number;
    purchaseDate: string;
    proyectoId?: string;
    depositId?: string | null;
    sapCode?: string;
    categoryId?: string | null;
    entidadId?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    last_purchase_price: opts.unitPrice,
    last_purchase_date: opts.purchaseDate,
    updated_at: new Date().toISOString(),
  };
  if (opts.unitPrice > 0) {
    patch.average_weighted_cost = opts.unitPrice;
  }
  if (opts.proyectoId) patch.proyecto_id = opts.proyectoId;
  if (opts.depositId) patch.deposit_id = opts.depositId;
  const sap = opts.sapCode?.trim();
  if (sap) patch.sap_code = sap;
  if (opts.categoryId) patch.category_id = opts.categoryId;
  if (opts.entidadId) patch.entidad_id = opts.entidadId;

  const { error } = await supabase.from('global_inventory').update(patch).eq('id', materialId);
  if (error) throw error;
}

/** Crea material en catálogo cuando no hubo coincidencia (misma lógica que recepción de mercancía). */
export async function crearMaterialParaLineaCompra(
  supabase: SupabaseClient,
  opts: {
    descripcion: string;
    item_code?: string | null;
    unidad?: string;
    precio_unitario: number;
    fecha: string;
    proyectoId: string;
    depositId?: string | null;
    categoryId?: string | null;
    entidadId?: string | null;
  },
): Promise<string> {
  const desc = opts.descripcion.trim();
  if (desc.length < 2) {
    throw new Error('Descripción demasiado corta para crear material.');
  }

  const materialBase: Record<string, unknown> = {
    name: desc,
    unit: (opts.unidad || 'UND').trim() || 'UND',
    stock_available: 0,
    stock_quarantine: 0,
    reorder_point: 0,
    average_weighted_cost: opts.precio_unitario,
    last_purchase_price: opts.precio_unitario,
    last_purchase_date: opts.fecha,
    proyecto_id: opts.proyectoId,
  };
  const sap = opts.item_code?.trim();
  if (sap) materialBase.sap_code = sap;
  if (opts.depositId) materialBase.deposit_id = opts.depositId;
  if (opts.categoryId) materialBase.category_id = opts.categoryId;
  if (opts.entidadId) materialBase.entidad_id = opts.entidadId;

  let res = await supabase.from('global_inventory').insert(materialBase).select('id').single();
  if (res.error && /deposit_id/i.test(res.error.message)) {
    const { deposit_id: _d, ...sinDeposito } = materialBase;
    res = await supabase.from('global_inventory').insert(sinDeposito).select('id').single();
  }
  if (res.error) throw new Error(res.error.message);
  return String((res.data as { id: string }).id);
}
