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

export function claveFacturaProveedorParams(params: {
  invoice_number?: string | null;
  supplier_rif?: string | null;
  supplier_name?: string | null;
}): string | null {
  const inv = normalizeInvoiceNumber(params.invoice_number ?? '');
  if (!inv || inv.toUpperCase() === 'S/N' || inv.toUpperCase() === 'SN') return null;

  const rif = normalizarRif(params.supplier_rif);
  const prov = rif && rif !== 'SR' ? rif : normalizarNombreProveedor(params.supplier_name);
  if (!prov) return null;

  return `${inv}|${prov}`;
}

export function claveFacturaProveedorCompra(
  c: Pick<CompraContablePorFactura, 'invoice_number' | 'supplier_rif' | 'supplier_name'>,
): string | null {
  return claveFacturaProveedorParams(c);
}

export function extractedCoincideFacturaProveedor(
  extracted: Record<string, unknown> | null | undefined,
  params: {
    invoice_number?: string | null;
    supplier_rif?: string | null;
    supplier_name?: string | null;
  },
): boolean {
  const ex = extracted ?? {};
  const invA = normalizeInvoiceNumber(String(ex.invoice_number ?? ''));
  const invB = normalizeInvoiceNumber(params.invoice_number ?? '');
  if (!invA || !invB || invA !== invB) return false;

  return proveedorCoincide(
    {
      supplier_rif: String(ex.supplier_rif ?? ''),
      supplier_name: String(ex.supplier_name ?? ''),
    },
    params.supplier_rif,
    params.supplier_name,
  );
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
    /** Si true, no excluye por proyecto distinto (anti-duplicado global). */
    ignorar_proyecto?: boolean;
  },
): Promise<CompraContablePorFactura | null> {
  const variants = invoiceNumberVariants(params.invoice_number);
  if (!variants.length) return null;

  const normInvoice = normalizeInvoiceNumber(params.invoice_number);
  const proyectoId = params.proyecto_id?.trim() || null;
  const ignorarProyecto = params.ignorar_proyecto === true;

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
    if (
      !ignorarProyecto &&
      proyectoId &&
      String(row.proyecto_id ?? '').trim() &&
      row.proyecto_id !== proyectoId
    ) {
      return false;
    }
    return true;
  }) as CompraContablePorFactura[];

  return candidatas[0] ?? null;
}

export type PendienteCanalDuplicado = {
  id: string;
  estado: string;
  purchase_invoice_id: string | null;
};

/** Otro pendiente de canal con la misma factura/proveedor (evita doble cola OCR). */
export async function buscarPendienteCanalDuplicado(
  supabase: SupabaseClient,
  params: {
    invoice_number: string;
    supplier_rif?: string | null;
    supplier_name?: string | null;
    excluirId?: string;
  },
): Promise<PendienteCanalDuplicado | null> {
  const variants = invoiceNumberVariants(params.invoice_number);
  if (!variants.length) return null;

  const { data, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, estado, purchase_invoice_id, extracted')
    .in('estado', ['extraido', 'confirmado', 'procesando', 'aprobado_sistema'])
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    if (error.code === '42P01') return null;
    throw new Error(error.message);
  }

  const hit = (data ?? []).find((row) => {
    if (params.excluirId && row.id === params.excluirId) return false;
    return extractedCoincideFacturaProveedor(
      row.extracted as Record<string, unknown> | null,
      params,
    );
  });

  if (!hit?.id) return null;
  return {
    id: String(hit.id),
    estado: String(hit.estado ?? ''),
    purchase_invoice_id: hit.purchase_invoice_id ? String(hit.purchase_invoice_id) : null,
  };
}
