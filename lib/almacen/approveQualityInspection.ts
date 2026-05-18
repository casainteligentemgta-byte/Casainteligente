import type { SupabaseClient } from '@supabase/supabase-js';
import type { MovementType } from '@/types/inventory';

function formatApproveError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: string }).message);
    const code =
      'code' in error ? String((error as { code?: string }).code ?? '') : '';
    if (code === '42501' || /row-level security/i.test(msg)) {
      return 'Sin permiso en Supabase. Ejecute las migraciones 134 y 136 en el SQL Editor.';
    }
    if (/inventory_movements/i.test(msg) && /does not exist/i.test(msg)) {
      return 'Falta la tabla inventory_movements. Revise el esquema de almacén en Supabase.';
    }
    return msg;
  }
  if (error instanceof Error) return error.message;
  return 'No se pudo aprobar la inspección.';
}

async function registerMovement(
  supabase: SupabaseClient,
  params: {
    material_id: string;
    type: MovementType;
    quantity: number;
    reference_id?: string | null;
    unit_price?: number;
    user_id?: string | null;
  }
) {
  const { material_id, type, quantity, reference_id, unit_price, user_id } = params;

  const { data: item, error: itemError } = await supabase
    .from('global_inventory')
    .select('stock_available, average_weighted_cost, stock_quarantine')
    .eq('id', material_id)
    .single();

  if (itemError || !item) {
    throw new Error('Material no encontrado en inventario.');
  }

  const prevStock = Number(item.stock_available) || 0;
  const prevCost = Number(item.average_weighted_cost) || 0;
  let newStock = prevStock;
  let newCost = prevCost;

  if (type === '101') {
    newStock = prevStock + quantity;
    const price = unit_price ?? 0;
    newCost =
      newStock > 0
        ? (prevStock * prevCost + quantity * price) / newStock
        : price;
  } else if (type === '201') {
    newStock = prevStock - quantity;
  } else if (type === '501' || type === '601') {
    newStock = prevStock + quantity;
  }

  const { error: updateError } = await supabase
    .from('global_inventory')
    .update({
      stock_available: newStock,
      average_weighted_cost: newCost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', material_id);

  if (updateError) throw updateError;

  const { error: movementError } = await supabase.from('inventory_movements').insert({
    material_id,
    movement_type_code: type,
    quantity,
    previous_stock: prevStock,
    new_stock: newStock,
    previous_cost: prevCost,
    new_cost: newCost,
    reference_id: reference_id ?? null,
    user_id: user_id ?? null,
  });

  if (movementError) throw movementError;

  return { newStock, newCost };
}

/**
 * Aprueba inspección en cuarentena: baja stock_quarantine y suma stock_available (mov. 101).
 * No requiere sesión auth (compatible con clave anon).
 */
export async function approveQualityInspection(
  supabase: SupabaseClient,
  inspectionId: string,
  inspectorId?: string | null
): Promise<void> {
  const { data: inspection, error: fetchError } = await supabase
    .from('quality_inspections')
    .select('id, material_id, quantity, invoice_id, purchase_detail_id, status')
    .eq('id', inspectionId)
    .single();

  if (fetchError || !inspection) {
    throw new Error('Inspección no encontrada.');
  }
  if (inspection.status !== 'PENDIENTE') {
    throw new Error('Esta inspección ya fue procesada.');
  }

  let unitPrice = 0;
  if (inspection.purchase_detail_id) {
    const { data: detail } = await supabase
      .from('purchase_details')
      .select('unit_price')
      .eq('id', inspection.purchase_detail_id)
      .maybeSingle();
    unitPrice = Number(detail?.unit_price) || 0;
  }

  const { error: updateInspError } = await supabase
    .from('quality_inspections')
    .update({
      status: 'APROBADO',
      inspector_id: inspectorId ?? null,
      inspected_at: new Date().toISOString(),
    })
    .eq('id', inspectionId);

  if (updateInspError) throw updateInspError;

  const { data: item } = await supabase
    .from('global_inventory')
    .select('stock_quarantine')
    .eq('id', inspection.material_id)
    .single();

  const qty = Number(inspection.quantity) || 0;
  const quarantine = Math.max(0, (Number(item?.stock_quarantine) || 0) - qty);

  const { error: quarantineError } = await supabase
    .from('global_inventory')
    .update({ stock_quarantine: quarantine })
    .eq('id', inspection.material_id);

  if (quarantineError) throw quarantineError;

  await registerMovement(supabase, {
    material_id: inspection.material_id,
    type: '101',
    quantity: qty,
    reference_id: inspection.invoice_id,
    unit_price: unitPrice,
    user_id: inspectorId ?? null,
  });
}

export { formatApproveError };
