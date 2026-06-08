import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normaliza id de cola canal (`uuid` o `canal-uuid`). */
export function resolveIdPendienteCanal(raw: string | undefined | null): string {
  let id = String(raw ?? '').trim();
  if (id.startsWith('canal-')) id = id.slice('canal-'.length);
  if (!id || id === 'undefined' || id === 'null') {
    throw new Error('ID de factura no válido. Recarga la página e inténtalo de nuevo.');
  }
  if (!UUID_RE.test(id)) {
    throw new Error('ID de factura no válido.');
  }
  return id;
}

export type PendienteCanal = {
  id: string;
  canal: string;
  chat_id?: string;
  chat_label: string | null;
  estado: string;
  proyecto_id?: string | null;
  entidad_id?: string | null;
  ubicacion_destino_id?: string | null;
  purchase_invoice_id?: string | null;
  document_file_name: string | null;
  document_storage_path?: string | null;
  extracted: ExtractedCanalHeader | null;
  mensaje_error: string | null;
  created_at: string;
};

export type ModoListaCanal = 'default' | 'lista_compras' | 'panel_canal';

export async function listarPendientesCanal(
  modo: ModoListaCanal = 'default',
): Promise<PendienteCanal[]> {
  const q =
    modo === 'lista_compras'
      ? '?para=lista_compras'
      : modo === 'panel_canal'
        ? '?para=panel_canal'
        : '';
  const res = await fetch(`/api/facturas-canal/pendientes${q}`, { cache: 'no-store' });
  const data = (await res.json()) as { pendientes?: PendienteCanal[]; error?: string };
  if (!res.ok) throw new Error(data.error || 'Error al cargar facturas del canal');
  return data.pendientes ?? [];
}

export async function actualizarPendienteCanal(
  rawId: string,
  patch: {
    extracted?: ExtractedCanalHeader;
    estado?: string;
    mensaje_error?: string | null;
    proyecto_id?: string;
    ubicacion_destino_id?: string;
  },
): Promise<PendienteCanal> {
  const id = resolveIdPendienteCanal(rawId);
  const res = await fetch(`/api/facturas-canal/pendientes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as { pendiente?: PendienteCanal; error?: string };
  if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
  if (!data.pendiente) throw new Error('Respuesta incompleta del servidor');
  return data.pendiente;
}

export type EliminarPendienteCanalResult = {
  materialPermaneceEnStock?: boolean;
};

export async function confirmarCompraCanal(
  rawId: string,
  body: {
    proyecto_id: string;
    ubicacion_destino_id: string;
    entidad_id?: string;
    imputacion_entidad?: boolean;
    clasificacion_gasto_entidad?: string | null;
    extracted?: ExtractedCanalHeader;
    /** Fast-track: liberar cuarentena al confirmar (omitir en flujo normal). */
    ingreso_almacen_automatico?: boolean;
  },
): Promise<{
  compraId: string;
  purchaseInvoiceId: string;
  yaExistia: boolean;
  cuarentena?: {
    lineasCreadas: number;
    yaExistia: boolean;
    notificado?: boolean;
  } | null;
  ingresoAlmacen?: {
    success: boolean;
    compraFacturaId?: string;
    yaExistia?: boolean;
    viaCuarentena?: boolean;
    aprobadas?: number;
    error?: string;
  } | null;
}> {
  const id = resolveIdPendienteCanal(rawId);
  const res = await fetch(
    `/api/facturas-canal/pendientes/${encodeURIComponent(id)}/confirmar-compra`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json()) as {
    compraId?: string;
    purchaseInvoiceId?: string;
    yaExistia?: boolean;
    cuarentena?: {
      lineasCreadas: number;
      yaExistia: boolean;
      notificado?: boolean;
    } | null;
    ingresoAlmacen?: {
      success: boolean;
      compraFacturaId?: string;
      yaExistia?: boolean;
      viaCuarentena?: boolean;
      aprobadas?: number;
      error?: string;
    } | null;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || 'No se pudo registrar la compra');
  if (!data.compraId) throw new Error('Respuesta incompleta del servidor');
  return {
    compraId: data.compraId,
    purchaseInvoiceId: data.purchaseInvoiceId ?? '',
    yaExistia: Boolean(data.yaExistia),
    cuarentena: data.cuarentena ?? null,
    ingresoAlmacen: data.ingresoAlmacen ?? null,
  };
}

export async function ingresoAlmacenCanal(
  rawId: string,
): Promise<{ compraFacturaId: string; yaExistia: boolean }> {
  const id = resolveIdPendienteCanal(rawId);
  const res = await fetch(
    `/api/facturas-canal/pendientes/${encodeURIComponent(id)}/ingreso-almacen`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
  );
  const data = (await res.json()) as {
    compraFacturaId?: string;
    yaExistia?: boolean;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || 'No se pudo registrar ingreso a almacén');
  if (!data.compraFacturaId) throw new Error('Respuesta incompleta del servidor');
  return {
    compraFacturaId: data.compraFacturaId,
    yaExistia: Boolean(data.yaExistia),
  };
}

export async function eliminarPendienteCanal(
  rawId: string,
  options?: { eliminarComprasVinculadas?: boolean },
): Promise<EliminarPendienteCanalResult> {
  const id = resolveIdPendienteCanal(rawId);
  const qs = options?.eliminarComprasVinculadas ? '?completo=1' : '';
  const res = await fetch(
    `/api/facturas-canal/pendientes/${encodeURIComponent(id)}${qs}`,
    { method: 'DELETE' },
  );
  const data = (await res.json()) as {
    error?: string;
    materialPermaneceEnStock?: boolean;
  };
  if (!res.ok) throw new Error(data.error || 'No se pudo eliminar');
  return { materialPermaneceEnStock: data.materialPermaneceEnStock };
}
