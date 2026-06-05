import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeInvoiceNumber } from '@/lib/contabilidad/deleteCompraRegistro';

export type CompraContablePorFactura = {
  id: string;
  purchase_invoice_id: string | null;
  invoice_number: string;
  supplier_rif: string | null;
  supplier_name: string | null;
  proyecto_id: string | null;
};

function invoiceNumberVariants(n: string): string[] {
  const base = normalizeInvoiceNumber(n);
  if (!base) return [];
  return Array.from(new Set([base, `#${base}`, n.trim()]));
}

function normalizarRif(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function rifUtil(rif: string | null | undefined): boolean {
  const n = normalizarRif(rif);
  return Boolean(n && n !== 'SR');
}

function normalizarNombreProveedor(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function proveedorCoincide(
  row: Pick<CompraContablePorFactura, 'supplier_rif' | 'supplier_name'>,
  supplierRif: string | null | undefined,
  supplierName: string | null | undefined,
): boolean {
  if (rifUtil(supplierRif) && rifUtil(row.supplier_rif)) {
    return normalizarRif(row.supplier_rif) === normalizarRif(supplierRif);
  }

  const nameA = normalizarNombreProveedor(row.supplier_name);
  const nameB = normalizarNombreProveedor(supplierName);
  if (nameA && nameB && nameA === nameB) return true;

  return false;
}

/**
 * Busca una compra contable ya registrada con el mismo proveedor y número de factura.
 * Evita duplicados cuando Telegram y la web confirman en paralelo o hay varios pendientes.
 */
export async function buscarCompraContablePorFactura(
  supabase: SupabaseClient,
  params: {
    invoice_number: string;
    supplier_rif?: string | null;
    supplier_name?: string | null;
    proyecto_id?: string | null;
  },
): Promise<CompraContablePorFactura | null> {
  const variants = invoiceNumberVariants(params.invoice_number);
  if (!variants.length) return null;

  const normInvoice = normalizeInvoiceNumber(params.invoice_number);
  const proyectoId = params.proyecto_id?.trim() || null;

  const { data, error } = await supabase
    .from('contabilidad_compras')
    .select('id, purchase_invoice_id, invoice_number, supplier_rif, supplier_name, proyecto_id')
    .in('invoice_number', variants)
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    if (error.code === '42P01') return null;
    throw new Error(error.message);
  }

  const candidatas = (data ?? []).filter((row) => {
    if (normalizeInvoiceNumber(row.invoice_number) !== normInvoice) return false;
    if (!proveedorCoincide(row, params.supplier_rif, params.supplier_name)) return false;
    if (proyectoId && String(row.proyecto_id ?? '').trim() && row.proyecto_id !== proyectoId) {
      return false;
    }
    return true;
  }) as CompraContablePorFactura[];

  return candidatas[0] ?? null;
}
