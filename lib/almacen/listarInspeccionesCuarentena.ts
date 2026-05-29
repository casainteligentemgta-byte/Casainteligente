import type { SupabaseClient } from '@supabase/supabase-js';

export type InspeccionCuarentenaRow = {
  id: string;
  quantity: number;
  material_id: string;
  invoice_id: string;
  line_description: string | null;
  material_name: string | null;
  material_unit: string | null;
  invoice_number: string | null;
  supplier_name: string | null;
  document_storage_path: string | null;
  document_file_name: string | null;
  ubicacion_destino_id: string | null;
  created_at: string | null;
};

/** Ítems en cuarentena (quality_inspections PENDIENTE). */
export async function listarInspeccionesCuarentenaPendientes(
  supabase: SupabaseClient,
  limit = 120,
): Promise<InspeccionCuarentenaRow[]> {
  const { data, error } = await supabase
    .from('quality_inspections')
    .select(
      `
      id,
      quantity,
      material_id,
      invoice_id,
      line_description,
      created_at,
      global_inventory(name, unit),
      purchase_invoices(invoice_number, supplier_name, document_storage_path, document_file_name, ubicacion_destino_id),
      purchase_details(description)
    `,
    )
    .eq('status', 'PENDIENTE')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      quantity: number;
      material_id: string;
      invoice_id: string;
      line_description: string | null;
      created_at: string | null;
      global_inventory?:
        | { name: string; unit: string }
        | Array<{ name: string; unit: string }>
        | null;
      purchase_invoices?:
        | {
            invoice_number: string;
            supplier_name: string;
            document_storage_path: string | null;
            document_file_name: string | null;
            ubicacion_destino_id: string | null;
          }
        | Array<{
            invoice_number: string;
            supplier_name: string;
            document_storage_path: string | null;
            document_file_name: string | null;
            ubicacion_destino_id: string | null;
          }>
        | null;
      purchase_details?: { description: string } | Array<{ description: string }> | null;
    };
    const gi = Array.isArray(r.global_inventory) ? r.global_inventory[0] : r.global_inventory;
    const inv = Array.isArray(r.purchase_invoices) ? r.purchase_invoices[0] : r.purchase_invoices;
    return {
      id: String(r.id),
      quantity: Number(r.quantity) || 0,
      material_id: String(r.material_id),
      invoice_id: String(r.invoice_id),
      line_description: r.line_description,
      material_name: gi?.name ?? null,
      material_unit: gi?.unit ?? null,
      invoice_number: inv?.invoice_number ?? null,
      supplier_name: inv?.supplier_name ?? null,
      document_storage_path: inv?.document_storage_path ?? null,
      document_file_name: inv?.document_file_name ?? null,
      ubicacion_destino_id: inv?.ubicacion_destino_id ?? null,
      created_at: r.created_at,
    };
  });
}

export function etiquetaInspeccionCuarentena(row: InspeccionCuarentenaRow): string {
  const desc =
    row.line_description?.trim() ||
    row.material_name?.trim() ||
    'Material';
  const qty = row.quantity;
  const unit = row.material_unit?.trim() || 'UND';
  return `${desc} · ${qty} ${unit}`;
}
