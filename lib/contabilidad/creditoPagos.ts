/**
 * Cuentas por pagar: estado de pago de facturas a crédito.
 * Independiente de purchase_invoices.status (flujo de inventario).
 */

export const CREDITO_COMPROBANTES_BUCKET = 'credito-comprobantes';
export const CREDITOS_POR_PAGINA = 5;
export const EPS_USD = 0.009;

export type EstadoPagoCredito = 'pagado' | 'por_pagar' | 'vencido';
export type TipoRecordatorioCredito = '3_dias' | 'vencimiento' | 'vencido';

export type AlcanceEntidadesCredito = {
  todas: boolean;
  entidadIds: string[];
};

export type FacturaCreditoRow = {
  id: string;
  invoice_number?: string | null;
  supplier_name?: string | null;
  entidad_id?: string | null;
  proyecto_id?: string | null;
  fecha_vencimiento?: string | null;
  dias_credito?: number | null;
  date?: string | null;
  total_amount?: number | null;
  total_amount_usd?: number | null;
  monto_usd?: number | null;
  moneda?: string | null;
};

export type CompraCreditoRow = {
  id: string;
  purchase_invoice_id?: string | null;
  entidad_id?: string | null;
  invoice_number?: string | null;
  supplier_name?: string | null;
  total_amount?: number | null;
  total_amount_usd?: number | null;
  monto_usd?: number | null;
  moneda?: string | null;
};

export type PagoCreditoRow = {
  purchase_invoice_id?: string | null;
  monto_usd?: number | null;
};

export type CreditoAbierto = {
  purchaseInvoiceId: string;
  contabilidadCompraId: string | null;
  proveedor: string;
  numeroFactura: string;
  entidadId: string | null;
  entidadNombre: string;
  proyectoId: string | null;
  fechaVencimiento: string | null;
  diasCredito: number | null;
  totalUsd: number;
  pagadoUsd: number;
  saldoUsd: number;
  diasHasta: number | null;
  estado: EstadoPagoCredito;
};

export function redondearUsd(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function montoUsdCredito(row: {
  total_amount?: number | null;
  total_amount_usd?: number | null;
  monto_usd?: number | null;
  moneda?: string | null;
}): number {
  if (row.monto_usd != null && Number.isFinite(Number(row.monto_usd))) {
    return redondearUsd(Number(row.monto_usd));
  }
  if (row.total_amount_usd != null && Number.isFinite(Number(row.total_amount_usd))) {
    return redondearUsd(Number(row.total_amount_usd));
  }
  const moneda = String(row.moneda ?? '').trim().toUpperCase();
  const total = Number(row.total_amount);
  if (moneda === 'USD' && Number.isFinite(total)) return redondearUsd(total);
  if (Number.isFinite(total) && total > 0 && moneda !== 'VES' && moneda !== 'BS' && moneda !== 'VESD') {
    return redondearUsd(total);
  }
  return Number.isFinite(total) ? redondearUsd(total) : 0;
}

export function saldoCredito(totalUsd: number, pagadoUsd: number): number {
  return Math.max(0, redondearUsd(totalUsd - pagadoUsd));
}

export function creditoQuedaPagado(totalUsd: number, pagadoUsd: number): boolean {
  return saldoCredito(totalUsd, pagadoUsd) <= EPS_USD;
}

export function diasHastaVencimiento(
  fechaVencimiento: string | null | undefined,
  hoyIso: string,
): number | null {
  const vence = String(fechaVencimiento ?? '').slice(0, 10);
  const hoy = String(hoyIso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vence) || !/^\d{4}-\d{2}-\d{2}$/.test(hoy)) return null;
  const a = Date.parse(`${vence}T00:00:00Z`);
  const b = Date.parse(`${hoy}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

export function textoPlazoCredito(dias: number | null): string {
  if (dias == null) return 'sin vencimiento';
  if (dias > 0) return `faltan ${dias} día${dias === 1 ? '' : 's'}`;
  if (dias === 0) return 'vence hoy';
  const n = Math.abs(dias);
  return `vencido hace ${n} día${n === 1 ? '' : 's'}`;
}

export function estadoPagoCredito(opts: {
  saldoUsd: number;
  diasHasta: number | null;
}): EstadoPagoCredito {
  if (opts.saldoUsd <= EPS_USD) return 'pagado';
  if (opts.diasHasta != null && opts.diasHasta < 0) return 'vencido';
  return 'por_pagar';
}

export function etiquetaEstadoPagoCredito(estado: EstadoPagoCredito): string {
  if (estado === 'pagado') return 'Pagado';
  if (estado === 'vencido') return 'Vencido';
  return 'Por pagar';
}

export function tipoRecordatorioCredito(diasHasta: number | null): TipoRecordatorioCredito | null {
  if (diasHasta == null) return null;
  if (diasHasta === 3) return '3_dias';
  if (diasHasta === 0) return 'vencimiento';
  if (diasHasta < 0) return 'vencido';
  return null;
}

export const ROLES_TELEGRAM_CREDITO = ['Comprador', 'Administrador', 'Contador'] as const;

export function rolTelegramPuedeCredito(rol: string | null | undefined): boolean {
  const r = String(rol ?? '').trim();
  return (ROLES_TELEGRAM_CREDITO as readonly string[]).includes(r);
}

export function creditoVisibleEnAlcance(
  entidadId: string | null | undefined,
  alcance: AlcanceEntidadesCredito,
): boolean {
  if (alcance.todas) return true;
  const id = String(entidadId ?? '').trim();
  if (!id) return false;
  return alcance.entidadIds.includes(id);
}

export function validarMontoPago(monto: number, saldo: number): string | null {
  if (!Number.isFinite(monto) || monto <= EPS_USD) return 'El monto debe ser mayor a 0.';
  if (redondearUsd(monto) > saldo + EPS_USD) return 'El monto supera el saldo.';
  return null;
}

export function formatearUsdCorto(monto: number): string {
  return redondearUsd(monto).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function avisoPagoAdminTelegram(opts: {
  proveedor: string;
  numero: string;
  montoUsd: number;
  nombre: string;
}): string {
  const prov = opts.proveedor.trim() || 'Proveedor';
  const nro = opts.numero.trim() || 'S/N';
  const quien = opts.nombre.trim() || 'alguien';
  return `✅ Pagado: ${prov} ${nro} · US$${formatearUsdCorto(opts.montoUsd)} · por ${quien}`;
}

export function lineaListaCreditoTelegram(c: CreditoAbierto, idx: number): string {
  const nro = escHtml(c.numeroFactura);
  const prov = escHtml(c.proveedor);
  const ent = escHtml(c.entidadNombre);
  const plazo = escHtml(textoPlazoCredito(c.diasHasta));
  const marca = c.estado === 'vencido' ? '🔴' : c.diasHasta === 0 ? '🟠' : '💳';
  return (
    `${idx}. ${marca} <b>${prov}</b> · #${nro} · ${ent}\n` +
    `   US$${formatearUsdCorto(c.saldoUsd)} · ${plazo}`
  );
}

export const CALLBACK_PAGAR_CREDITO = 'cr:p:';

export function textoBotonPagadoCredito(c: CreditoAbierto): string {
  const nro = c.numeroFactura.trim() || 'S/N';
  const prov = c.proveedor.trim() || 'Proveedor';
  const raw = `Pagado · ${prov} #${nro}`;
  return raw.length <= 64 ? raw : `${raw.slice(0, 63)}…`;
}

export function tecladoPagadoCredito(c: CreditoAbierto) {
  return {
    inline_keyboard: [[{ text: textoBotonPagadoCredito(c), callback_data: `${CALLBACK_PAGAR_CREDITO}${c.purchaseInvoiceId}` }]],
  };
}

export function htmlAnexoCreditosVencidos(items: CreditoAbierto[], max = 8): string {
  const vencidos = items.filter((c) => c.estado === 'vencido');
  if (!vencidos.length) return '';
  const lineas = vencidos.slice(0, max).map((c) => {
    const n = Math.abs(c.diasHasta ?? 0);
    const plazo = c.diasHasta == null ? 'sin fecha' : `hace ${n} día${n === 1 ? '' : 's'}`;
    return `• ${escHtml(c.proveedor)} #${escHtml(c.numeroFactura)} · US$${formatearUsdCorto(c.saldoUsd)} · ${escHtml(plazo)}`;
  });
  const extra = vencidos.length > max ? `\n… y ${vencidos.length - max} más` : '';
  return (
    `🔴 <b>Créditos vencidos</b> (${vencidos.length})\n` +
    lineas.join('\n') +
    extra +
    `\n<i>/credito para marcar pagado</i>`
  );
}

export function paginaCreditos<T>(
  items: T[],
  page: number,
  size = CREDITOS_POR_PAGINA,
): { slice: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / Math.max(1, size)));
  const safe = Math.min(Math.max(0, Math.floor(page)), totalPages - 1);
  const start = safe * size;
  return { slice: items.slice(start, start + size), page: safe, totalPages };
}

export function ordenarCreditosPorVencimiento(items: CreditoAbierto[]): CreditoAbierto[] {
  return [...items].sort((a, b) => {
    const va = a.fechaVencimiento ?? '9999-99-99';
    const vb = b.fechaVencimiento ?? '9999-99-99';
    if (va !== vb) return va.localeCompare(vb);
    return a.proveedor.localeCompare(b.proveedor, 'es');
  });
}

export function sumarPagosPorFactura(pagos: PagoCreditoRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of pagos) {
    const id = String(p.purchase_invoice_id ?? '').trim();
    if (!id) continue;
    const monto = Number(p.monto_usd);
    if (!Number.isFinite(monto) || monto <= 0) continue;
    out.set(id, redondearUsd((out.get(id) ?? 0) + monto));
  }
  return out;
}

export function armarCreditosAbiertos(opts: {
  facturas: FacturaCreditoRow[];
  compras: CompraCreditoRow[];
  pagos: PagoCreditoRow[];
  nombresEntidad: Record<string, string>;
  hoyIso: string;
  alcance: AlcanceEntidadesCredito;
}): CreditoAbierto[] {
  const pagosPorFactura = sumarPagosPorFactura(opts.pagos);
  const compraPorFactura = new Map<string, CompraCreditoRow>();
  for (const c of opts.compras) {
    const pid = String(c.purchase_invoice_id ?? '').trim();
    if (!pid) continue;
    if (!compraPorFactura.has(pid)) compraPorFactura.set(pid, c);
  }

  const out: CreditoAbierto[] = [];
  for (const f of opts.facturas) {
    const id = String(f.id ?? '').trim();
    if (!id) continue;
    const compra = compraPorFactura.get(id) ?? null;
    const entidadId =
      String(compra?.entidad_id ?? f.entidad_id ?? '').trim() || null;
    if (!creditoVisibleEnAlcance(entidadId, opts.alcance)) continue;

    const totalUsd = montoUsdCredito(compra ?? f);
    const pagadoUsd = pagosPorFactura.get(id) ?? 0;
    const saldoUsd = saldoCredito(totalUsd, pagadoUsd);
    if (saldoUsd <= EPS_USD) continue;

    const diasHasta = diasHastaVencimiento(f.fecha_vencimiento, opts.hoyIso);
    const estado = estadoPagoCredito({ saldoUsd, diasHasta });
    out.push({
      purchaseInvoiceId: id,
      contabilidadCompraId: compra?.id ? String(compra.id) : null,
      proveedor: String(compra?.supplier_name ?? f.supplier_name ?? '').trim() || 'Proveedor',
      numeroFactura: String(compra?.invoice_number ?? f.invoice_number ?? '').trim() || 'S/N',
      entidadId,
      entidadNombre: (entidadId && opts.nombresEntidad[entidadId]) || 'Sin entidad',
      proyectoId: f.proyecto_id ? String(f.proyecto_id) : null,
      fechaVencimiento: f.fecha_vencimiento ? String(f.fecha_vencimiento).slice(0, 10) : null,
      diasCredito: f.dias_credito != null ? Number(f.dias_credito) : null,
      totalUsd,
      pagadoUsd,
      saldoUsd,
      diasHasta,
      estado,
    });
  }
  return ordenarCreditosPorVencimiento(out);
}

export function resumenPagoCompra(opts: {
  condicionPago?: string | null;
  fechaVencimiento?: string | null;
  pagadoUsd: number;
  totalUsd: number;
  hoyIso: string;
}): { estado: EstadoPagoCredito | null; saldoUsd: number } {
  if (String(opts.condicionPago ?? '').trim().toLowerCase() !== 'credito') {
    return { estado: null, saldoUsd: 0 };
  }
  const saldoUsd = saldoCredito(opts.totalUsd, opts.pagadoUsd);
  const diasHasta = diasHastaVencimiento(opts.fechaVencimiento, opts.hoyIso);
  return { estado: estadoPagoCredito({ saldoUsd, diasHasta }), saldoUsd };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
