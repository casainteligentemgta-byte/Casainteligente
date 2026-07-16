import type { InspeccionCuarentenaRow } from '@/lib/almacen/listarInspeccionesCuarentena';

export type FacturaCuarentenaGrupo = {
  invoice_id: string;
  invoice_number: string | null;
  supplier_name: string | null;
  document_storage_path: string | null;
  document_file_name: string | null;
  ubicacion_destino_id: string | null;
  lineas: InspeccionCuarentenaRow[];
  totalUnidades: number;
};

export function agruparInspeccionesPorFactura(
  rows: InspeccionCuarentenaRow[],
): FacturaCuarentenaGrupo[] {
  const map = new Map<string, FacturaCuarentenaGrupo>();

  for (const row of rows) {
    const prev = map.get(row.invoice_id);
    if (prev) {
      prev.lineas.push(row);
      prev.totalUnidades += row.quantity;
      continue;
    }
    map.set(row.invoice_id, {
      invoice_id: row.invoice_id,
      invoice_number: row.invoice_number,
      supplier_name: row.supplier_name,
      document_storage_path: row.document_storage_path,
      document_file_name: row.document_file_name,
      ubicacion_destino_id: row.ubicacion_destino_id,
      lineas: [row],
      totalUnidades: row.quantity,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const na = a.invoice_number ?? '';
    const nb = b.invoice_number ?? '';
    return nb.localeCompare(na, 'es');
  });
}
