/** Convierte facturas Telegram pendientes al mismo formato que `contabilidad_compras` en la UI. */

import {
  claveFacturaProveedorCompra,
  claveFacturaProveedorParams,
  mismaFacturaProveedorCompra,
} from '@/lib/contabilidad/buscarCompraContablePorFactura';
import { normalizarMonedaExtracted } from '@/lib/contabilidad/extractedCanal';
import type {
  EstadoLogisticaCompra,
  LogisticaConteos,
} from '@/lib/contabilidad/estadoLogisticaCompra';

export type ExtractedCanalItem = {
  description?: string;
  item_code?: string;
  quantity?: number;
  unit_price?: number;
};

export type ExtractedCanalHeader = {
  invoice_number?: string;
  supplier_name?: string;
  supplier_rif?: string;
  date?: string;
  total_amount?: number | null;
  moneda?: string | null;
  items?: ExtractedCanalItem[];
};

export type CanalPendienteParaLista = {
  id: string;
  canal: string;
  estado: string;
  proyecto_id?: string | null;
  entidad_id?: string | null;
  ubicacion_destino_id?: string | null;
  purchase_invoice_id?: string | null;
  document_file_name: string | null;
  document_storage_path?: string | null;
  mensaje_error?: string | null;
  created_at: string;
  extracted: ExtractedCanalHeader | null;
};

export type CompraLineaUi = {
  id?: string;
  descripcion: string;
  item_code: string | null;
  subtotal: number;
  cantidad: number;
  precio_unitario?: number;
};

/** Fila unificada para listado de compras (app + Telegram pendiente). */
export type CompraListaUnificada = {
  id: string;
  purchase_invoice_id: string | null;
  proyecto_id: string | null;
  entidad_id?: string | null;
  entidad_nombre?: string | null;
  proyecto_nombre?: string | null;
  invoice_number: string;
  supplier_rif: string;
  supplier_name: string;
  fecha: string;
  total_amount: number;
  total_amount_usd?: number | null;
  tasa_bcv_ves_por_usd?: number | null;
  origen: string;
  estado: string;
  document_file_name: string | null;
  document_storage_path?: string | null;
  created_at: string;
  ci_proyectos?: { nombre: string | null } | { nombre: string | null }[] | null;
  contabilidad_compra_lineas?: CompraLineaUi[];
  /** `telegram` = pendiente canal; `app` = contabilidad_compras */
  fuente_lista: 'app' | 'telegram';
  pendiente_canal_id?: string;
  canal_estado?: string;
  mensaje_error_canal?: string | null;
  ubicacion_destino_id?: string | null;
  ubicacion_nombre?: string | null;
  /** Flujo logístico: registrada → cuarentena → en_almacén */
  estado_logistica?: EstadoLogisticaCompra | null;
  logistica_conteos?: LogisticaConteos | null;
  compra_factura_id?: string | null;
  ingresado_almacen_at?: string | null;
  cuarentena_rechazo_total?: boolean;
  compra_factura?: { numero_factura?: string | null; estado?: string | null } | null;
  moneda?: string | null;
  moneda_original?: string | null;
  monto_ves?: number | null;
  monto_usd?: number | null;
  /** obra = valuación AD; entidad = gasto del patrono */
  imputacion?: 'obra' | 'entidad' | null;
  clasificacion_gasto_entidad?: 'operacional' | 'administrativo' | 'servicio' | null;
  alerta_fecha?: 'advertencia' | 'critico' | null;
  fecha_confirmada_manual?: boolean | null;
};

export function lineasDesdeExtractedCanal(ex: ExtractedCanalHeader | null): CompraLineaUi[] {
  if (!ex?.items?.length) return [];
  return ex.items.map((it) => {
    const cantidad = Number(it.quantity) > 0 ? Number(it.quantity) : 0;
    const precio = Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0;
    return {
      descripcion: String(it.description ?? '').trim(),
      item_code: it.item_code?.trim() || null,
      cantidad,
      precio_unitario: precio,
      subtotal: cantidad * precio,
    };
  });
}

export function mapCanalPendienteACompraLista(p: CanalPendienteParaLista): CompraListaUnificada {
  const ex = p.extracted;
  const lineas = lineasDesdeExtractedCanal(ex);
  const total =
    ex?.total_amount != null && Number.isFinite(Number(ex.total_amount))
      ? Number(ex.total_amount)
      : lineas.reduce((s, l) => s + l.subtotal, 0);

  return {
    id: `canal-${p.id}`,
    purchase_invoice_id: p.purchase_invoice_id ?? null,
    proyecto_id: p.proyecto_id ?? null,
    entidad_id: p.entidad_id ?? null,
    ubicacion_destino_id: p.ubicacion_destino_id ?? null,
    invoice_number: String(ex?.invoice_number ?? '—').trim() || '—',
    supplier_rif: String(ex?.supplier_rif ?? '').trim(),
    supplier_name: String(ex?.supplier_name ?? 'Proveedor').trim() || 'Proveedor',
    fecha: (ex?.date ?? p.created_at).slice(0, 10),
    total_amount: total,
    total_amount_usd: null,
    tasa_bcv_ves_por_usd: null,
    moneda: normalizarMonedaExtracted(ex?.moneda),
    moneda_original: normalizarMonedaExtracted(ex?.moneda),
    origen: 'TELEGRAM',
    estado:
      p.estado === 'extraido'
        ? 'PENDIENTE_CONFIRMACION'
        : p.estado === 'confirmado'
          ? 'REGISTRADA'
          : p.estado === 'error'
            ? 'ERROR_EXTRACCION'
            : p.estado.toUpperCase(),
    document_file_name: p.document_file_name,
    document_storage_path: p.document_storage_path ?? null,
    created_at: p.created_at,
    contabilidad_compra_lineas: lineas,
    fuente_lista: 'telegram',
    pendiente_canal_id: p.id,
    canal_estado: p.estado,
    mensaje_error_canal: p.mensaje_error ?? null,
  };
}

export type FiltroFuenteCompra = '' | 'todos' | 'app' | 'telegram';

export function compraCoincideFuente(c: CompraListaUnificada, fuente: FiltroFuenteCompra): boolean {
  if (!fuente || fuente === 'todos') return true;
  if (fuente === 'telegram') {
    return c.fuente_lista === 'telegram' || c.origen === 'TELEGRAM';
  }
  const esApp = c.fuente_lista === 'app' || c.fuente_lista == null;
  return esApp && c.origen !== 'TELEGRAM';
}

const ESTADOS_CANAL_EN_COLA = new Set(['extraido', 'error', 'procesando', 'pendiente']);

function clavePendienteCanal(p: CanalPendienteParaLista): string | null {
  return claveFacturaProveedorParams({
    invoice_number: p.extracted?.invoice_number,
    supplier_rif: p.extracted?.supplier_rif,
    supplier_name: p.extracted?.supplier_name,
  });
}

/** Mayor puntaje = fila preferida cuando hay duplicados de la misma factura/proveedor. */
export function puntajePreferenciaCompraLista(c: CompraListaUnificada): number {
  let score = 0;
  if (c.pendiente_canal_id) score += 100;
  if (c.origen === 'TELEGRAM') score += 50;
  if (c.purchase_invoice_id) score += 20;
  if (c.document_storage_path?.trim()) score += 10;
  if (Array.isArray(c.contabilidad_compra_lineas) && c.contabilidad_compra_lineas.length > 0) {
    const first = c.contabilidad_compra_lineas[0];
    if (first && 'descripcion' in first) score += 5;
  }
  if (!c.id.startsWith('canal-')) score += 15;
  else score -= 40;
  if (c.origen === 'RECEPCION_MERCANCIA' && !c.pendiente_canal_id) score -= 80;
  return score;
}

function fusionarMetadataCompraPreferida(
  preferida: CompraListaUnificada,
  descartada: CompraListaUnificada,
): CompraListaUnificada {
  return {
    ...preferida,
    estado_logistica: preferida.estado_logistica ?? descartada.estado_logistica ?? null,
    logistica_conteos: preferida.logistica_conteos ?? descartada.logistica_conteos ?? null,
    compra_factura_id: preferida.compra_factura_id ?? descartada.compra_factura_id ?? null,
    ingresado_almacen_at: preferida.ingresado_almacen_at ?? descartada.ingresado_almacen_at ?? null,
  };
}

/**
 * Una sola fila por factura+proveedor en el listado (evita doble tarjeta Telegram + recepción).
 */
export function deduplicarComprasLista(compras: CompraListaUnificada[]): CompraListaUnificada[] {
  const unicas: CompraListaUnificada[] = [];

  for (const c of compras) {
    const idx = unicas.findIndex((u) => mismaFacturaProveedorCompra(u, c));
    if (idx === -1) {
      unicas.push(c);
      continue;
    }
    const prev = unicas[idx]!;
    if (puntajePreferenciaCompraLista(c) > puntajePreferenciaCompraLista(prev)) {
      unicas[idx] = fusionarMetadataCompraPreferida(c, prev);
    } else {
      unicas[idx] = fusionarMetadataCompraPreferida(prev, c);
    }
  }

  return unicas.sort((a, b) => {
    const fa = String(a.fecha ?? '').slice(0, 10);
    const fb = String(b.fecha ?? '').slice(0, 10);
    if (fa !== fb) return fb.localeCompare(fa);
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });
}

/**
 * Une compras de contabilidad con el canal Telegram: pendientes en cola + etiqueta en confirmadas.
 */
function enriquecerCompraConCanal(
  c: CompraListaUnificada,
  canal: CanalPendienteParaLista,
): CompraListaUnificada {
  const lineasCanal = lineasDesdeExtractedCanal(canal.extracted);
  const lineasActuales = c.contabilidad_compra_lineas;
  const tieneLineas =
    Array.isArray(lineasActuales) && lineasActuales.length > 0;

  return {
    ...c,
    fuente_lista: 'telegram',
    pendiente_canal_id: canal.id,
    canal_estado: canal.estado,
    origen: 'TELEGRAM',
    proyecto_id: c.proyecto_id ?? canal.proyecto_id ?? null,
    entidad_id: c.entidad_id ?? canal.entidad_id ?? null,
    ubicacion_destino_id: c.ubicacion_destino_id ?? canal.ubicacion_destino_id ?? null,
    document_storage_path: c.document_storage_path ?? canal.document_storage_path ?? null,
    document_file_name: c.document_file_name ?? canal.document_file_name,
    contabilidad_compra_lineas: tieneLineas ? lineasActuales : lineasCanal,
  };
}

export function unificarComprasConCanal(
  compras: CompraListaUnificada[],
  pendientes: CanalPendienteParaLista[],
): CompraListaUnificada[] {
  const porInvoice = new Map<string, CanalPendienteParaLista>();
  const porCanalId = new Map<string, CanalPendienteParaLista>();
  const porClave = new Map<string, CanalPendienteParaLista>();
  for (const p of pendientes) {
    porCanalId.set(p.id, p);
    if (p.purchase_invoice_id) porInvoice.set(p.purchase_invoice_id, p);
    const clave = clavePendienteCanal(p);
    if (clave && !porClave.has(clave)) porClave.set(clave, p);
  }

  const filas = compras.map((c) => {
    const claveCompra = claveFacturaProveedorCompra(c);
    const canal =
      (c.purchase_invoice_id && porInvoice.get(c.purchase_invoice_id)) ||
      (c.pendiente_canal_id && porCanalId.get(c.pendiente_canal_id)) ||
      (claveCompra ? porClave.get(claveCompra) : undefined);
    if (!canal) {
      return { ...c, fuente_lista: c.fuente_lista ?? 'app' };
    }
    return enriquecerCompraConCanal({ ...c, fuente_lista: c.fuente_lista ?? 'app' }, canal);
  });

  const invoiceEnFilas = new Set(
    filas.map((c) => c.purchase_invoice_id).filter((id): id is string => Boolean(id)),
  );
  const canalIdsEnFilas = new Set(
    filas.map((c) => c.pendiente_canal_id).filter((id): id is string => Boolean(id)),
  );
  const clavesFacturaEnFilas = new Set(
    filas
      .map((c) => claveFacturaProveedorCompra(c))
      .filter((k): k is string => Boolean(k)),
  );

  const extras = pendientes
    .filter((p) => {
      if (canalIdsEnFilas.has(p.id)) return false;
      if (p.purchase_invoice_id && invoiceEnFilas.has(p.purchase_invoice_id)) return false;

      const clave = clavePendienteCanal(p);
      if (clave && clavesFacturaEnFilas.has(clave)) return false;

      const refPendiente = {
        invoice_number: p.extracted?.invoice_number ?? '',
        supplier_rif: p.extracted?.supplier_rif ?? '',
        supplier_name: p.extracted?.supplier_name ?? '',
      };
      if (filas.some((f) => mismaFacturaProveedorCompra(f, refPendiente))) return false;

      if (ESTADOS_CANAL_EN_COLA.has(p.estado)) return true;
      if (p.estado === 'confirmado') return true;
      return false;
    })
    .map(mapCanalPendienteACompraLista);

  return deduplicarComprasLista([...extras, ...filas]);
}

export function etiquetaOrigenCompra(c: CompraListaUnificada): string {
  if (c.fuente_lista === 'telegram' || c.origen === 'TELEGRAM') return 'Telegram';
  if (c.origen === 'RECEPCION_MERCANCIA') return 'Recepción';
  return c.origen || 'App';
}
