import type { SupabaseClient } from '@supabase/supabase-js';
import type { LineaCompraContabilidadInput } from '@/lib/contabilidad/registerCompraDesdeRecepcion';

export function normSkuCodigo(s: string): string {
  return s.trim().toUpperCase();
}

export async function cargarMapaSkuGlobalInventory(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('global_inventory')
    .select('id, sap_code')
    .not('sap_code', 'is', null);

  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const sku = normSkuCodigo(String((row as { sap_code?: string }).sap_code ?? ''));
    const id = String((row as { id: string }).id);
    if (sku) map.set(sku, id);
  }
  return map;
}

export async function enriquecerLineasConMaterialPorSku(
  supabase: SupabaseClient,
  lineas: LineaCompraContabilidadInput[],
): Promise<{ lineas: LineaCompraContabilidadInput[]; sinMatch: string[] }> {
  const mapa = await cargarMapaSkuGlobalInventory(supabase);
  const sinMatch: string[] = [];

  const out = lineas.map((l) => {
    if (l.material_id?.trim()) return l;
    const cod = normSkuCodigo(String(l.item_code ?? ''));
    if (!cod) {
      sinMatch.push(l.descripcion?.trim() || 'Línea sin SKU');
      return l;
    }
    const matId = mapa.get(cod);
    if (!matId) {
      sinMatch.push(cod);
      return l;
    }
    return { ...l, material_id: matId };
  });

  return { lineas: out, sinMatch };
}

type LineaCompraDb = {
  id: string;
  material_id: string | null;
  item_code: string | null;
  descripcion: string | null;
};

/**
 * Rellena material_id en contabilidad_compra_lineas por item_code (facturas Telegram ya confirmadas).
 */
export async function resolverMaterialIdLineasCompra(
  supabase: SupabaseClient,
  compraId: string,
): Promise<{
  total: number;
  vinculadas: number;
  sinMatch: string[];
  lineas: Array<{
    material_id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
  }>;
}> {
  const { data: raw, error } = await supabase
    .from('contabilidad_compra_lineas')
    .select('id,material_id,item_code,descripcion,cantidad,precio_unitario')
    .eq('compra_id', compraId);

  if (error) throw new Error(error.message);

  const lineas = (raw ?? []) as LineaCompraDb[];
  const mapa = await cargarMapaSkuGlobalInventory(supabase);
  const sinMatch: string[] = [];
  let vinculadas = 0;

  const paraInventario: Array<{
    material_id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
  }> = [];

  for (const l of lineas) {
    let matId = l.material_id?.trim() ?? '';
    if (!matId) {
      const cod = normSkuCodigo(String(l.item_code ?? ''));
      if (cod) {
        matId = mapa.get(cod) ?? '';
        if (matId) {
          await supabase
            .from('contabilidad_compra_lineas')
            .update({ material_id: matId })
            .eq('id', l.id);
        } else {
          sinMatch.push(cod);
        }
      } else {
        sinMatch.push(String(l.descripcion ?? 'Sin SKU').trim() || 'Línea');
      }
    }
    if (matId) {
      vinculadas += 1;
      const cantidad = Number(l.cantidad ?? 0);
      if (cantidad > 0) {
        paraInventario.push({
          material_id: matId,
          descripcion: String(l.descripcion ?? '').trim() || 'Ítem',
          cantidad,
          precio_unitario: Number(l.precio_unitario ?? 0),
        });
      }
    }
  }

  return {
    total: lineas.length,
    vinculadas,
    sinMatch,
    lineas: paraInventario,
  };
}

export function mensajeLineasSinMaterialSku(sinMatch: string[]): string {
  if (!sinMatch.length) return '';
  const muestra = sinMatch.slice(0, 5).join(', ');
  const extra = sinMatch.length > 5 ? ` (+${sinMatch.length - 5})` : '';
  return `Sin material en catálogo para SKU/descripción: ${muestra}${extra}. Revise item_code en la factura o cree el material en Almacén.`;
}
