import { parseMontoFiltro } from '@/lib/contabilidad/comprasQueryFiltros';
import { montoUsdCompra, tasaBcvCompra, vesAUsdConTasa } from '@/lib/contabilidad/comprasMontos';

export type ExtractedInvoiceItem = {
  description?: string;
  item_code?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
};

export type ExtractedInvoiceHeader = {
  invoice_number?: string;
  supplier_name?: string;
  supplier_rif?: string;
  date?: string;
  total_amount?: number | null;
};

export type FilaFacturaCanal = {
  pendienteId: string;
  canal: string;
  estado: string;
  chat_label: string | null;
  fecha: string;
  factura: string;
  proveedor: string;
  rif: string;
  montoBs: number;
  montoUsd: number | null;
  /** Tasa BCV de la factura (bolívares por 1 USD). */
  tasaBcv: number | null;
  articulo: string;
  codigo: string;
  cantidad: number;
  precioUnitario: number;
  esLinea: boolean;
};

export type FiltrosFacturaCanal = {
  fechaDesde?: string;
  fechaHasta?: string;
  proveedor?: string;
  rif?: string;
  articulo?: string;
  cantidadMin?: string;
  cantidadMax?: string;
  montoMinBs?: string;
  montoMaxBs?: string;
  montoMinUsd?: string;
  montoMaxUsd?: string;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function incluye(texto: string, term: string): boolean {
  const t = norm(term);
  if (!t) return true;
  return norm(texto).includes(t);
}

function enRango(n: number, min: number | null, max: number | null): boolean {
  if (min !== null && n < min) return false;
  if (max !== null && n > max) return false;
  return true;
}

export function aplanarFacturasCanal(
  pendientes: Array<{
    id: string;
    canal: string;
    estado: string;
    chat_label: string | null;
    extracted: (ExtractedInvoiceHeader & { items?: ExtractedInvoiceItem[] }) | null;
  }>,
): FilaFacturaCanal[] {
  const filas: FilaFacturaCanal[] = [];

  for (const p of pendientes) {
    const ex = p.extracted;
    if (!ex || p.estado !== 'extraido') continue;

    const base = {
      pendienteId: p.id,
      canal: p.canal,
      estado: p.estado,
      chat_label: p.chat_label,
      fecha: (ex.date ?? '').slice(0, 10),
      factura: ex.invoice_number ?? '',
      proveedor: ex.supplier_name ?? '',
      rif: ex.supplier_rif ?? '',
      montoBs: Number(ex.total_amount) || 0,
      montoUsd: null as number | null,
      tasaBcv: null as number | null,
    };

    const items = Array.isArray(ex.items) ? ex.items : [];
    if (items.length === 0) {
      filas.push({
        ...base,
        articulo: '',
        codigo: '',
        cantidad: 0,
        precioUnitario: 0,
        esLinea: false,
      });
      continue;
    }

    for (const it of items) {
      filas.push({
        ...base,
        articulo: (it.description ?? '').trim(),
        codigo: (it.item_code ?? '').trim(),
        cantidad: Number(it.quantity) > 0 ? Number(it.quantity) : 0,
        precioUnitario: Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0,
        esLinea: true,
      });
    }
  }

  return filas;
}

export function filtrarFilasFacturaCanal(
  filas: FilaFacturaCanal[],
  f: FiltrosFacturaCanal,
): FilaFacturaCanal[] {
  const minBs = parseMontoFiltro(f.montoMinBs ?? '');
  const maxBs = parseMontoFiltro(f.montoMaxBs ?? '');
  const minUsd = parseMontoFiltro(f.montoMinUsd ?? '');
  const maxUsd = parseMontoFiltro(f.montoMaxUsd ?? '');
  const minCant = parseMontoFiltro(f.cantidadMin ?? '');
  const maxCant = parseMontoFiltro(f.cantidadMax ?? '');
  const desde = f.fechaDesde?.trim() || '';
  const hasta = f.fechaHasta?.trim() || '';

  return filas.filter((row) => {
    if (desde && row.fecha && row.fecha < desde) return false;
    if (hasta && row.fecha && row.fecha > hasta) return false;
    if (f.proveedor?.trim() && !incluye(row.proveedor, f.proveedor)) return false;
    if (f.rif?.trim() && !incluye(row.rif, f.rif)) return false;
    if (f.articulo?.trim()) {
      if (!incluye(row.articulo, f.articulo) && !incluye(row.codigo, f.articulo)) return false;
    }
    if (row.esLinea && (minCant !== null || maxCant !== null)) {
      if (!enRango(row.cantidad, minCant, maxCant)) return false;
    }
    const montoLineaBs = row.esLinea
      ? row.cantidad * row.precioUnitario
      : row.montoBs;
    if (!enRango(montoLineaBs, minBs, maxBs)) return false;
    const usdLinea =
      vesAUsdConTasa(montoLineaBs, row.tasaBcv) ??
      (row.montoUsd != null && row.montoBs > 0
        ? (montoLineaBs / row.montoBs) * row.montoUsd
        : row.montoUsd);
    if (minUsd !== null || maxUsd !== null) {
      if (usdLinea == null || !enRango(usdLinea, minUsd, maxUsd)) return false;
    }
    return true;
  });
}

export function pendienteIdsDesdeFilas(filas: FilaFacturaCanal[]): Set<string> {
  return new Set(filas.map((r) => r.pendienteId));
}

export type CompraConfirmadaParaLineas = {
  id: string;
  fecha: string;
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  total_amount: number;
  total_amount_usd?: number | null;
  tasa_bcv_ves_por_usd?: number | null;
  origen: string;
  estado: string;
  proyectoNombre?: string;
  lineas: Array<{
    descripcion: string;
    item_code: string | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
};

/** Una fila por línea de compra confirmada (o cabecera si no hay detalle). */
export function aplanarComprasConfirmadas(compras: CompraConfirmadaParaLineas[]): FilaFacturaCanal[] {
  const filas: FilaFacturaCanal[] = [];

  for (const c of compras) {
    const montoUsd = montoUsdCompra(c);
    const base = {
      pendienteId: c.id,
      canal: c.origen || 'compra',
      estado: c.estado || 'REGISTRADA',
      chat_label: null,
      fecha: (c.fecha ?? '').slice(0, 10),
      factura: c.invoice_number ?? '',
      proveedor: c.supplier_name ?? '',
      rif: c.supplier_rif ?? '',
      montoBs: Number(c.total_amount) || 0,
      montoUsd,
      tasaBcv: tasaBcvCompra(c),
    };

    if (!c.lineas.length) {
      filas.push({
        ...base,
        articulo: '',
        codigo: '',
        cantidad: 0,
        precioUnitario: 0,
        esLinea: false,
      });
      continue;
    }

    for (const l of c.lineas) {
      const cantidad = Number(l.cantidad) > 0 ? Number(l.cantidad) : 0;
      const precio =
        Number(l.precio_unitario) >= 0
          ? Number(l.precio_unitario)
          : cantidad > 0
            ? Number(l.subtotal) / cantidad
            : 0;
      filas.push({
        ...base,
        articulo: (l.descripcion ?? '').trim(),
        codigo: (l.item_code ?? '').trim(),
        cantidad,
        precioUnitario: precio,
        esLinea: true,
      });
    }
  }

  return filas;
}

/** Filtra líneas de compras confirmadas con los mismos criterios que facturas de canal. */
export function filtrarLineasComprasConfirmadas(
  compras: CompraConfirmadaParaLineas[],
  filtros: FiltrosFacturaCanal,
): FilaFacturaCanal[] {
  return filtrarFilasFacturaCanal(aplanarComprasConfirmadas(compras), filtros);
}

/** Monto en bolívares de una compra registrada. */
export function montoBsCompra(row: { total_amount: number }): number {
  return Number(row.total_amount) || 0;
}

export type FiltrosComprasAvanzados = {
  rif?: string;
  articulo?: string;
  cantidadMin?: string;
  cantidadMax?: string;
  montoMinBs?: string;
  montoMaxBs?: string;
  montoMinUsd?: string;
  montoMaxUsd?: string;
};

export type LineaCompraFiltro = {
  descripcion: string;
  item_code: string | null;
  cantidad: number;
};

export function compraCumpleFiltrosLineas(
  lineas: LineaCompraFiltro[],
  f: Pick<FiltrosComprasAvanzados, 'articulo' | 'cantidadMin' | 'cantidadMax'>,
): boolean {
  const art = f.articulo?.trim();
  const minCant = parseMontoFiltro(f.cantidadMin ?? '');
  const maxCant = parseMontoFiltro(f.cantidadMax ?? '');
  if (!art && minCant === null && maxCant === null) return true;

  return lineas.some((l) => {
    if (art && !incluye(l.descripcion, art) && !incluye(l.item_code ?? '', art)) return false;
    if (!enRango(Number(l.cantidad), minCant, maxCant)) return false;
    return true;
  });
}

export function compraCumpleFiltrosMontos(
  row: {
    total_amount: number;
    total_amount_usd?: number | null;
    monto_usd?: number | null;
    tasa_bcv_ves_por_usd?: number | null;
  },
  f: Pick<FiltrosComprasAvanzados, 'montoMinBs' | 'montoMaxBs' | 'montoMinUsd' | 'montoMaxUsd'>,
): boolean {
  const minBs = parseMontoFiltro(f.montoMinBs ?? '');
  const maxBs = parseMontoFiltro(f.montoMaxBs ?? '');
  const minUsd = parseMontoFiltro(f.montoMinUsd ?? '');
  const maxUsd = parseMontoFiltro(f.montoMaxUsd ?? '');

  const bs = montoBsCompra(row);
  const usd = montoUsdCompra(row);

  if (!enRango(bs, minBs, maxBs)) return false;
  if (minUsd !== null || maxUsd !== null) {
    if (!enRango(usd, minUsd, maxUsd)) return false;
  }
  return true;
}

export function compraCumpleFiltroRif(
  row: { supplier_rif: string },
  rif: string | undefined,
): boolean {
  if (!rif?.trim()) return true;
  return incluye(row.supplier_rif, rif);
}
