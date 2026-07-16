import { normalizeInvoiceNumber } from '@/lib/contabilidad/deleteCompraRegistro';

export type CamposLlaveNaturalCompra = {
  fecha: string;
  invoice_number: string;
  supplier_rif?: string | null;
  supplier_name?: string | null;
  monto_usd?: number | null;
  monto_ves?: number | null;
  proyecto_id?: string | null;
};

function normTexto(v: string | null | undefined): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function normRif(v: string | null | undefined): string {
  const r = normTexto(v);
  return r && r !== 'SR' && r !== 'SINRIF' ? r : '';
}

function normFecha(fecha: string): string {
  const s = String(fecha ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function normMonto(n: number | null | undefined): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.00';
  return x.toFixed(2);
}

/**
 * Llave natural canónica (pre-hash): fecha|factura|proveedor|monto|proyecto
 * Segura para cliente y servidor (sin crypto).
 */
export function cadenaLlaveNaturalCompra(campos: CamposLlaveNaturalCompra): string {
  const fecha = normFecha(campos.fecha);
  const invoice = normalizeInvoiceNumber(campos.invoice_number) || 'SN';
  const rif = normRif(campos.supplier_rif);
  const nombre = normTexto(campos.supplier_name);
  const proveedor = rif || nombre || 'SINPROV';
  const montoUsd = Number(campos.monto_usd);
  const monto =
    Number.isFinite(montoUsd) && montoUsd > 0
      ? `USD:${normMonto(montoUsd)}`
      : `VES:${normMonto(campos.monto_ves)}`;
  const proyecto = String(campos.proyecto_id ?? '').trim() || 'SIN-PROY';
  return [fecha, invoice, proveedor, monto, proyecto].join('|');
}

export function mismaLlaveNaturalCompra(
  a: CamposLlaveNaturalCompra,
  b: CamposLlaveNaturalCompra,
): boolean {
  return cadenaLlaveNaturalCompra(a) === cadenaLlaveNaturalCompra(b);
}
