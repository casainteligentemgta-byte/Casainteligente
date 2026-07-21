import {
  esCompraSoloAuditoriaCco,
  esDescripcionAuditoriaCco,
} from '@/lib/contabilidad/compraEsAuditoriaCco';
import { parseMontoFiltro } from '@/lib/contabilidad/comprasQueryFiltros';
import { montoUsdCompra, tasaBcvCompra, vesAUsdConTasa } from '@/lib/contabilidad/comprasMontos';
import {
  monedaOriginalCompra,
  montosBimonetariosLista,
  precioUnitarioDesdeRepartoLinea,
  subtotalBsLineaCompra,
  subtotalLineaEnMonedaOriginal,
  subtotalUsdLineaCompra,
} from '@/lib/contabilidad/monedaCompra';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';
import type { EstadoLogisticaCompra } from '@/lib/contabilidad/estadoLogisticaCompra';

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
  entidad?: string;
  proyecto?: string;
  almacen?: string;
  /** true si la compra ya tiene ingreso físico (fallback columna almacén). */
  almacenIngresado?: boolean;
  estadoLogistica?: EstadoLogisticaCompra | null;
  entidadId?: string | null;
  proyectoId?: string | null;
  montoBs: number;
  montoUsd: number | null;
  /** Tasa BCV de la factura (bolívares por 1 USD). */
  tasaBcv: number | null;
  /** Moneda original de la factura (precios de línea en esta moneda). */
  monedaOriginal?: MonedaOrigen;
  articulo: string;
  codigo: string;
  cantidad: number;
  precioUnitario: number;
  esLinea: boolean;
  /** Bs/USD asignados a la línea (proporcional al total bimonetario de la factura). */
  subtotalBsLinea?: number;
  subtotalUsdLinea?: number | null;
  /** UUID contabilidad_compra_lineas (solo compras confirmadas en app). */
  lineaId?: string | null;
  alertaFecha?: 'advertencia' | 'critico' | null;
  fechaConfirmadaManual?: boolean | null;
  fechaRegistro?: string | null;
};

export type FiltrosFacturaCanal = {
  fechaDesde?: string;
  fechaHasta?: string;
  proveedor?: string;
  rif?: string;
  articulo?: string;
  entidadId?: string;
  proyectoId?: string;
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
    if (f.entidadId?.trim()) {
      if (f.entidadId === 'sin_entidad') {
        if (row.entidadId) return false;
      } else if ((row.entidadId ?? '') !== f.entidadId) {
        return false;
      }
    }
    if (f.proyectoId?.trim()) {
      if (f.proyectoId === 'sin_proyecto') {
        if (row.proyectoId) return false;
      } else if ((row.proyectoId ?? '') !== f.proyectoId) {
        return false;
      }
    }
    if (f.articulo?.trim()) {
      if (!incluye(row.articulo, f.articulo) && !incluye(row.codigo, f.articulo)) return false;
    }
    if (row.esLinea && (minCant !== null || maxCant !== null)) {
      if (!enRango(row.cantidad, minCant, maxCant)) return false;
    }
    const montoLineaBs = subtotalBsLineaCompra(row);
    if (!enRango(montoLineaBs, minBs, maxBs)) return false;
    const usdLinea = subtotalUsdLineaCompra(row);
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
  moneda?: string | null;
  moneda_original?: string | null;
  monto_ves?: number | null;
  monto_usd?: number | null;
  origen: string;
  estado: string;
  proyectoNombre?: string;
  entidadNombre?: string;
  almacenNombre?: string;
  almacenIngresado?: boolean;
  estadoLogistica?: EstadoLogisticaCompra | null;
  entidadId?: string | null;
  proyectoId?: string | null;
  alerta_fecha?: 'advertencia' | 'critico' | null;
  fecha_confirmada_manual?: boolean | null;
  created_at?: string | null;
  lineas: Array<{
    id?: string;
    descripcion: string;
    item_code: string | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
};

/** Compra que solo trae logs de auditoría CCO (no es proveedor ni artículo real). */
export function compraEsAuditoriaImportada(c: CompraConfirmadaParaLineas): boolean {
  return esCompraSoloAuditoriaCco({
    supplier_name: c.supplier_name,
    invoice_number: c.invoice_number,
    lineas: c.lineas,
  });
}

export function repartirMontosFacturaEnLineas(
  montos: { bs: number; usd: number | null },
  lineas: Array<{ cantidad: number; precioUnitario: number }>,
): Array<{ bs: number; usd: number | null }> {
  const pesos = lineas.map((l) => Math.max(0, l.cantidad * l.precioUnitario));
  const sum = pesos.reduce((a, b) => a + b, 0);
  if (sum <= 0 || montos.bs <= 0) {
    return lineas.map(() => ({ bs: 0, usd: montos.usd != null ? 0 : null }));
  }

  const out: Array<{ bs: number; usd: number | null }> = [];
  let acBs = 0;
  let acUsd = 0;

  for (let i = 0; i < lineas.length; i++) {
    if (i === lineas.length - 1) {
      out.push({
        bs: Math.round((montos.bs - acBs) * 100) / 100,
        usd:
          montos.usd != null ? Math.round((montos.usd - acUsd) * 100) / 100 : null,
      });
      continue;
    }
    const ratio = pesos[i] / sum;
    const bs = Math.round(montos.bs * ratio * 100) / 100;
    const usd = montos.usd != null ? Math.round(montos.usd * ratio * 100) / 100 : null;
    acBs += bs;
    if (usd != null) acUsd += usd;
    out.push({ bs, usd });
  }

  return out;
}

export type LineaPrecioCompraInput = {
  cantidad: number;
  precio_unitario?: number | null;
  subtotal?: number | null;
};

export type LineaPrecioCompraRecalculada = {
  precio_unitario: number;
  subtotal: number;
  subtotalBs: number;
  subtotalUsd: number | null;
};

/** Recalcula P.U. y subtotales de líneas según moneda original y totales bimonetarios de cabecera. */
export function recalcularPreciosLineasCompra(
  fila: {
    total_amount: number;
    total_amount_usd?: number | null;
    tasa_bcv_ves_por_usd?: number | null;
    moneda?: string | null;
    moneda_original?: string | null;
    monto_ves?: number | null;
    monto_usd?: number | null;
  },
  lineas: LineaPrecioCompraInput[],
  tasa: number | null | undefined,
): LineaPrecioCompraRecalculada[] {
  if (!lineas.length) return [];

  const moneda = monedaOriginalCompra(fila);
  const montos = montosBimonetariosLista(fila, tasa ?? null);
  const parsed = lineas.map((l) => {
    const cantidad = Number(l.cantidad) > 0 ? Number(l.cantidad) : 0;
    const precio =
      l.precio_unitario != null && Number(l.precio_unitario) >= 0
        ? Number(l.precio_unitario)
        : cantidad > 0 && l.subtotal != null
          ? Number(l.subtotal) / cantidad
          : 0;
    return { cantidad, precioUnitario: precio };
  });
  const reparto = repartirMontosFacturaEnLineas({ bs: montos.bs, usd: montos.usd }, parsed);

  return lineas.map((l, i) => {
    const cantidad = parsed[i]?.cantidad ?? 0;
    const repartoLinea = reparto[i] ?? { bs: 0, usd: null };
    return {
      precio_unitario: precioUnitarioDesdeRepartoLinea(moneda, cantidad, repartoLinea),
      subtotal: subtotalLineaEnMonedaOriginal(moneda, cantidad, repartoLinea),
      subtotalBs: repartoLinea.bs,
      subtotalUsd: repartoLinea.usd,
    };
  });
}

/** Una fila por línea de compra confirmada (o cabecera si no hay detalle). */
export function aplanarComprasConfirmadas(compras: CompraConfirmadaParaLineas[]): FilaFacturaCanal[] {
  const filas: FilaFacturaCanal[] = [];

  for (const c of compras) {
    // Oculta filas de auditoría CCO mal importadas (artículo = log, proveedor = usuario).
    if (compraEsAuditoriaImportada(c)) continue;

    const tasa = c.tasa_bcv_ves_por_usd ?? tasaBcvCompra(c);
    const montos = montosBimonetariosLista(c, tasa);
    const moneda = monedaOriginalCompra(c);
    const base = {
      pendienteId: c.id,
      canal: c.origen || 'compra',
      estado: c.estado || 'REGISTRADA',
      chat_label: null,
      fecha: (c.fecha ?? '').slice(0, 10),
      factura: c.invoice_number ?? '',
      proveedor: c.supplier_name ?? '',
      rif: c.supplier_rif ?? '',
      entidad: c.entidadNombre?.trim() || '',
      proyecto: c.proyectoNombre?.trim() || '',
      almacen: c.almacenNombre?.trim() || '',
      almacenIngresado: c.almacenIngresado,
      estadoLogistica: c.estadoLogistica,
      entidadId: c.entidadId ?? null,
      proyectoId: c.proyectoId ?? null,
      montoBs: montos.bs,
      montoUsd: montos.usd,
      tasaBcv: tasa ?? tasaBcvCompra(c),
      monedaOriginal: moneda,
      alertaFecha: c.alerta_fecha ?? null,
      fechaConfirmadaManual: c.fecha_confirmada_manual ?? null,
      fechaRegistro: c.created_at ? String(c.created_at).slice(0, 10) : null,
    };

    if (!c.lineas.length) {
      filas.push({
        ...base,
        articulo: '',
        codigo: '',
        cantidad: 0,
        precioUnitario: 0,
        esLinea: false,
        subtotalBsLinea: montos.bs,
        subtotalUsdLinea: montos.usd,
      });
      continue;
    }

    // Nunca mostrar líneas sueltas de auditoría aunque la cabecera tenga otros ítems.
    const lineasOperativas = c.lineas.filter((l) => !esDescripcionAuditoriaCco(l.descripcion));
    if (!lineasOperativas.length) continue;

    const lineasParsed = lineasOperativas.map((l) => {
      const cantidad = Number(l.cantidad) > 0 ? Number(l.cantidad) : 0;
      const precio =
        Number(l.precio_unitario) >= 0
          ? Number(l.precio_unitario)
          : cantidad > 0
            ? Number(l.subtotal) / cantidad
            : 0;
      return {
        id: l.id?.trim() || null,
        descripcion: (l.descripcion ?? '').trim(),
        item_code: (l.item_code ?? '').trim(),
        cantidad,
        precioUnitario: precio,
      };
    });

    const reparto = repartirMontosFacturaEnLineas(
      { bs: montos.bs, usd: montos.usd },
      lineasParsed,
    );

    lineasParsed.forEach((l, i) => {
      const repartoLinea = reparto[i] ?? { bs: 0, usd: null };
      filas.push({
        ...base,
        lineaId: l.id,
        articulo: l.descripcion,
        codigo: l.item_code,
        cantidad: l.cantidad,
        precioUnitario: precioUnitarioDesdeRepartoLinea(moneda, l.cantidad, repartoLinea),
        esLinea: true,
        subtotalBsLinea: repartoLinea.bs,
        subtotalUsdLinea: repartoLinea.usd,
      });
    });
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

export function compraCumpleFiltroEntidad(
  row: { entidad_id?: string | null },
  entidadFiltro: string | undefined,
): boolean {
  const e = String(entidadFiltro ?? '').trim();
  if (!e) return true;
  if (e === 'sin_entidad') return !row.entidad_id;
  return row.entidad_id === e;
}

export function compraCumpleFiltroProyecto(
  row: { proyecto_id?: string | null },
  proyectoFiltro: string | undefined,
): boolean {
  const p = String(proyectoFiltro ?? '').trim();
  if (!p) return true;
  if (p === 'sin_proyecto') return !row.proyecto_id;
  return row.proyecto_id === p;
}

export function compraCumpleFiltroProveedor(
  row: { supplier_name?: string | null },
  proveedorFiltro: string | undefined,
): boolean {
  const prov = String(proveedorFiltro ?? '').trim();
  if (!prov) return true;
  return String(row.supplier_name ?? '').trim() === prov;
}

export function compraCumpleFiltroFecha(
  row: { fecha?: string | null; created_at?: string | null },
  desde: string | undefined,
  hasta: string | undefined,
): boolean {
  const d = String(desde ?? '').trim();
  const h = String(hasta ?? '').trim();
  if (!d && !h) return true;
  const f = String(row.fecha ?? row.created_at ?? '').slice(0, 10);
  if (!f) return false;
  if (d && f < d) return false;
  if (h && f > h) return false;
  return true;
}

/** Filtros de destino (entidad, obra, proveedor, fechas) tras enriquecer filas unificadas. */
export function compraCumpleFiltrosDestino(
  row: {
    entidad_id?: string | null;
    proyecto_id?: string | null;
    supplier_name?: string | null;
    fecha?: string | null;
    created_at?: string | null;
  },
  filtros: {
    entidadFiltro?: string;
    proyectoFiltro?: string;
    proveedorFiltro?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  },
): boolean {
  if (!compraCumpleFiltroEntidad(row, filtros.entidadFiltro)) return false;
  if (!compraCumpleFiltroProyecto(row, filtros.proyectoFiltro)) return false;
  if (!compraCumpleFiltroProveedor(row, filtros.proveedorFiltro)) return false;
  if (!compraCumpleFiltroFecha(row, filtros.fechaDesde, filtros.fechaHasta)) return false;
  return true;
}
