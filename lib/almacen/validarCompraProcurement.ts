import type { SupabaseClient } from '@supabase/supabase-js';

export type ValidacionCompraProcurement = {
  ok: boolean;
  errores: string[];
  advertencias: string[];
};

export type LineaCompraValidacion = {
  description: string;
  item_code?: string;
  quantity: number;
  unit_price: number;
};

/** Validaciones previas al guardar factura de compra (app). */
export async function validarCompraProcurement(
  supabase: SupabaseClient,
  input: {
    invoice_number: string;
    supplier_rif: string;
    supplier_name: string;
    total_amount: number;
    tasa_bcv: number | null;
    lineas: LineaCompraValidacion[];
  },
): Promise<ValidacionCompraProcurement> {
  const errores: string[] = [];
  const advertencias: string[] = [];

  const numero = input.invoice_number.trim();
  const rif = input.supplier_rif.trim() || 'S/R';

  if (!input.tasa_bcv || input.tasa_bcv <= 0) {
    errores.push('Indique la tasa BCV (Bs/USD) de la fecha de la factura.');
  }

  const lineasValidas = input.lineas.filter((l) => l.description.trim());
  for (let i = 0; i < lineasValidas.length; i++) {
    const l = lineasValidas[i];
    if (Number(l.quantity) <= 0) {
      errores.push(`Línea ${i + 1}: cantidad debe ser mayor a cero.`);
    }
    if (Number(l.unit_price) < 0) {
      errores.push(`Línea ${i + 1}: precio unitario inválido.`);
    }
  }

  const sumaLineas = lineasValidas.reduce(
    (acc, l) => acc + Number(l.quantity) * Number(l.unit_price),
    0,
  );
  const total = input.total_amount;
  if (sumaLineas > 0 && total > 0) {
    const diff = Math.abs(total - sumaLineas);
    const pct = diff / Math.max(total, sumaLineas);
    if (pct > 0.05) {
      advertencias.push(
        `El total (${total.toFixed(2)} Bs) difiere más del 5% de la suma de líneas (${sumaLineas.toFixed(2)} Bs).`,
      );
    } else if (diff > 0.02) {
      advertencias.push(
        `Pequeña diferencia entre total factura y suma de líneas (${diff.toFixed(2)} Bs).`,
      );
    }
  }

  if (numero) {
    const { data: dupInv } = await supabase
      .from('purchase_invoices')
      .select('id, invoice_number')
      .eq('invoice_number', numero)
      .eq('supplier_rif', rif)
      .limit(1)
      .maybeSingle();

    if (dupInv?.id) {
      errores.push(
        `Ya existe la factura ${numero} del proveedor ${rif}. No se permiten duplicados.`,
      );
    }

    const { data: dupCont } = await supabase
      .from('contabilidad_compras')
      .select('id')
      .eq('invoice_number', numero)
      .eq('supplier_rif', rif)
      .limit(1)
      .maybeSingle();

    if (dupCont?.id) {
      errores.push(`Nº ${numero} ya está registrado en contabilidad para este RIF.`);
    }
  }

  const sinSku = lineasValidas.filter((l) => !l.item_code?.trim()).length;
  if (sinSku > 0 && lineasValidas.length > 0) {
    advertencias.push(
      `${sinSku} línea(s) sin código/SKU — más difícil reconocer material existente.`,
    );
  }

  return { ok: errores.length === 0, errores, advertencias };
}
