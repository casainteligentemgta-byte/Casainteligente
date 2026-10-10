import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retiro de mercancía comprada (migración 341): el tramo entre «el comprador cargó la
 * factura» y «el almacén la recibió».
 *
 *   pendiente → asignado (alguien dijo «la retiro yo») → en_camino (foto al retirar)
 *   → entregado (el almacén registró el ingreso)
 *
 * Todas las funciones toleran que la tabla no exista: devuelven «sin_migracion» o null
 * y el flujo de compras sigue igual que antes de esta función.
 */

export const ESTADOS_RETIRO_COMPRA = [
  'pendiente',
  'asignado',
  'en_camino',
  'entregado',
  'cancelado',
] as const;

export type EstadoRetiroCompra = (typeof ESTADOS_RETIRO_COMPRA)[number];

export type FotoRetiroCompra = { storage_path: string };

export type RetiroCompra = {
  id: string;
  purchase_invoice_id: string;
  contabilidad_compra_id: string | null;
  procura_id: string | null;
  proyecto_id: string | null;
  ubicacion_destino_id: string | null;
  numero_factura: string | null;
  proveedor_nombre: string | null;
  estado: EstadoRetiroCompra;
  solicitado_por_chat_id: number | null;
  transportista_chat_id: number | null;
  transportista_nombre: string | null;
  fotos: FotoRetiroCompra[];
  asignado_at: string | null;
  retirado_at: string | null;
  entregado_at: string | null;
};

const TABLA = 'ci_compras_retiros';

const COLUMNAS =
  'id,purchase_invoice_id,contabilidad_compra_id,procura_id,proyecto_id,ubicacion_destino_id,' +
  'numero_factura,proveedor_nombre,estado,solicitado_por_chat_id,transportista_chat_id,' +
  'transportista_nombre,fotos,asignado_at,retirado_at,entregado_at';

type ErrorDb = { code?: string; message?: string } | null;

/** La tabla aún no existe (Postgres 42P01) o PostgREST no la conoce (PGRST205). */
export function esTablaRetirosAusente(error: ErrorDb): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /ci_compras_retiros/.test(error.message ?? '') && /does not exist|schema cache/i.test(error.message ?? '');
}

function chatIdNumerico(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function texto(v: unknown): string | null {
  const t = v == null ? '' : String(v).trim();
  return t || null;
}

function esEstadoRetiro(v: unknown): v is EstadoRetiroCompra {
  return (ESTADOS_RETIRO_COMPRA as readonly string[]).includes(String(v));
}

function mapRetiro(row: Record<string, unknown>): RetiroCompra {
  const fotosRaw = Array.isArray(row.fotos) ? row.fotos : [];
  return {
    id: String(row.id),
    purchase_invoice_id: String(row.purchase_invoice_id),
    contabilidad_compra_id: texto(row.contabilidad_compra_id),
    procura_id: texto(row.procura_id),
    proyecto_id: texto(row.proyecto_id),
    ubicacion_destino_id: texto(row.ubicacion_destino_id),
    numero_factura: texto(row.numero_factura),
    proveedor_nombre: texto(row.proveedor_nombre),
    estado: esEstadoRetiro(row.estado) ? row.estado : 'pendiente',
    solicitado_por_chat_id: chatIdNumerico(row.solicitado_por_chat_id),
    transportista_chat_id: chatIdNumerico(row.transportista_chat_id),
    transportista_nombre: texto(row.transportista_nombre),
    fotos: fotosRaw
      .map((f) => texto((f as { storage_path?: unknown })?.storage_path))
      .filter((p): p is string => p != null)
      .map((storage_path) => ({ storage_path })),
    asignado_at: texto(row.asignado_at),
    retirado_at: texto(row.retirado_at),
    entregado_at: texto(row.entregado_at),
  };
}

function primeraFila(data: unknown): RetiroCompra | null {
  const fila = Array.isArray(data) ? data[0] : data;
  return fila ? mapRetiro(fila as Record<string, unknown>) : null;
}

export type CrearRetiroCompraInput = {
  purchaseInvoiceId: string;
  contabilidadCompraId?: string | null;
  procuraId?: string | null;
  proyectoId?: string | null;
  ubicacionDestinoId?: string | null;
  numeroFactura?: string | null;
  proveedorNombre?: string | null;
  solicitadoPorChatId?: string | number | null;
};

export type CrearRetiroCompraResult =
  | { ok: true; retiro: RetiroCompra; creado: boolean }
  | { ok: false; motivo: 'sin_migracion' | 'error'; error?: string };

export async function obtenerRetiroPorFactura(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
): Promise<RetiroCompra | null> {
  const { data, error } = await supabase
    .from(TABLA)
    .select(COLUMNAS)
    .eq('purchase_invoice_id', purchaseInvoiceId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return mapRetiro(data as Record<string, unknown>);
}

export async function obtenerRetiro(
  supabase: SupabaseClient,
  retiroId: string,
): Promise<RetiroCompra | null> {
  const { data, error } = await supabase
    .from(TABLA)
    .select(COLUMNAS)
    .eq('id', retiroId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return mapRetiro(data as Record<string, unknown>);
}

/** Un retiro por factura. Si ya existe lo devuelve con `creado: false` (no se vuelve a avisar). */
export async function crearRetiroCompra(
  supabase: SupabaseClient,
  input: CrearRetiroCompraInput,
): Promise<CrearRetiroCompraResult> {
  const purchaseInvoiceId = input.purchaseInvoiceId.trim();
  if (!purchaseInvoiceId) return { ok: false, motivo: 'error', error: 'Factura sin id.' };

  const { data: previo, error: previoErr } = await supabase
    .from(TABLA)
    .select(COLUMNAS)
    .eq('purchase_invoice_id', purchaseInvoiceId)
    .maybeSingle();
  if (esTablaRetirosAusente(previoErr)) return { ok: false, motivo: 'sin_migracion' };
  if (previoErr) return { ok: false, motivo: 'error', error: previoErr.message };
  if (previo) return { ok: true, retiro: mapRetiro(previo as Record<string, unknown>), creado: false };

  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      purchase_invoice_id: purchaseInvoiceId,
      contabilidad_compra_id: texto(input.contabilidadCompraId),
      procura_id: texto(input.procuraId),
      proyecto_id: texto(input.proyectoId),
      ubicacion_destino_id: texto(input.ubicacionDestinoId),
      numero_factura: texto(input.numeroFactura),
      proveedor_nombre: texto(input.proveedorNombre),
      solicitado_por_chat_id: chatIdNumerico(input.solicitadoPorChatId),
      estado: 'pendiente',
      fotos: [],
    })
    .select(COLUMNAS)
    .single();

  if (esTablaRetirosAusente(error)) return { ok: false, motivo: 'sin_migracion' };
  if (error?.code === '23505') {
    // Dos confirmaciones a la vez: la otra ganó la carrera.
    const existente = await obtenerRetiroPorFactura(supabase, purchaseInvoiceId);
    if (existente) return { ok: true, retiro: existente, creado: false };
  }
  if (error || !data) return { ok: false, motivo: 'error', error: error?.message ?? 'Sin datos' };
  return { ok: true, retiro: mapRetiro(data as Record<string, unknown>), creado: true };
}

/**
 * «La retiro yo». Solo gana quien encuentra el retiro todavía pendiente: el filtro por
 * estado va en el mismo UPDATE, así dos toques simultáneos no asignan a dos personas.
 */
export async function tomarRetiroCompra(
  supabase: SupabaseClient,
  params: { retiroId: string; chatId: string | number; nombre: string },
): Promise<RetiroCompra | null> {
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      estado: 'asignado',
      transportista_chat_id: chatIdNumerico(params.chatId),
      transportista_nombre: params.nombre.trim().slice(0, 150) || 'Transportista',
      asignado_at: ahora,
      updated_at: ahora,
    })
    .eq('id', params.retiroId.trim())
    .eq('estado', 'pendiente')
    .select(COLUMNAS);
  if (error) return null;
  return primeraFila(data);
}

/** Quien lo tomó lo devuelve a pendiente (antes de enviar la foto). */
export async function liberarRetiroCompra(
  supabase: SupabaseClient,
  params: { retiroId: string; chatId: string | number },
): Promise<RetiroCompra | null> {
  const chat = chatIdNumerico(params.chatId);
  if (chat == null) return null;
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      estado: 'pendiente',
      transportista_chat_id: null,
      transportista_nombre: null,
      asignado_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.retiroId.trim())
    .eq('estado', 'asignado')
    .eq('transportista_chat_id', chat)
    .select(COLUMNAS);
  if (error) return null;
  return primeraFila(data);
}

/** El retiro más reciente que este chat tomó y al que todavía le falta la foto. */
export async function retiroEsperandoFoto(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<RetiroCompra | null> {
  const id = chatIdNumerico(chatId);
  if (id == null) return null;
  const { data, error } = await supabase
    .from(TABLA)
    .select(COLUMNAS)
    .eq('transportista_chat_id', id)
    .eq('estado', 'asignado')
    .order('asignado_at', { ascending: false })
    .limit(1);
  if (error) return null;
  return primeraFila(data);
}

/** Foto al retirar: el retiro pasa a «en camino». */
export async function registrarFotoRetiroCompra(
  supabase: SupabaseClient,
  params: { retiro: RetiroCompra; storagePath: string },
): Promise<RetiroCompra | null> {
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      estado: 'en_camino',
      fotos: [...params.retiro.fotos, { storage_path: params.storagePath }],
      retirado_at: ahora,
      updated_at: ahora,
    })
    .eq('id', params.retiro.id)
    .eq('estado', 'asignado')
    .select(COLUMNAS);
  if (error) return null;
  return primeraFila(data);
}

/**
 * El almacén registró el ingreso de la factura. Cierra el retiro esté en el estado que
 * esté (también si nadie lo tomó: la mercancía llegó por otra vía).
 * Devuelve el retiro tal como estaba antes de cerrarlo, o null si no había nada que cerrar.
 */
export async function marcarRetiroCompraEntregado(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
): Promise<RetiroCompra | null> {
  const previo = await obtenerRetiroPorFactura(supabase, purchaseInvoiceId);
  if (!previo || previo.estado === 'entregado' || previo.estado === 'cancelado') return null;

  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from(TABLA)
    .update({ estado: 'entregado', entregado_at: ahora, updated_at: ahora })
    .eq('id', previo.id)
    .in('estado', ['pendiente', 'asignado', 'en_camino']);
  if (error) return null;
  return previo;
}
