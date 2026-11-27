import type { SupabaseClient } from '@supabase/supabase-js';
import { validarLecturaFactura } from '@/lib/compras/validarLecturaFactura';

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
    moneda?: string | null;
    confidence_score?: number | null;
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

  const alertasLectura = validarLecturaFactura(
    {
      invoice_number: input.invoice_number,
      supplier_rif: input.supplier_rif,
      supplier_name: input.supplier_name,
      total_amount: input.total_amount,
      moneda: input.moneda ?? 'VES',
      confidence_score: input.confidence_score,
      items: lineasValidas,
    },
    { tasaBcv: input.tasa_bcv },
  );
  for (const a of alertasLectura) {
    if (a.tipo === 'cantidad_cero') continue;
    if (a.severidad === 'alerta') errores.push(a.mensaje);
    else advertencias.push(a.mensaje);
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
