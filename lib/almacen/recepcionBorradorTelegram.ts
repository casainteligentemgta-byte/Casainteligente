import type { SupabaseClient } from '@supabase/supabase-js';
import type { TipoRecepcionCampo } from '@/lib/almacen/recepcionCampoTypes';
import type { FormaIngresoRecepcion } from '@/lib/almacen/formaIngresoRecepcion';

export const METADATA_TOKEN_KEY = 'recepcion_campo_token';

export type LineaBorradorRecepcionTelegram = {
  material_id: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  forma_ingreso: FormaIngresoRecepcion;
  soporte_storage_path?: string | null;
  soporte_file_name?: string | null;
  soporte_mime_type?: string | null;
};

/** Pestaña de /almacen/recepcion que debe abrirse. */
export type VistaRecepcionBorrador = 'ingreso_manual' | 'nota_entrega' | 'emergencia';

export type BorradorRecepcionTelegramPayload = {
  token: string;
  /** Pestaña en la app (ingreso manual = URL sin tab). */
  vista: VistaRecepcionBorrador;
  /** Tipo para RPC ci_registrar_ingreso_manual_campo. */
  tipo: TipoRecepcionCampo;
  proyecto_id: string | null;
  ubicacion_id: string | null;
  proveedor_nombre: string;
  num_doc: string;
  observaciones: string;
  lineas: LineaBorradorRecepcionTelegram[];
  soporte_storage_path: string | null;
  soporte_file_name: string | null;
  soporte_mime_type: string | null;
  updated_at: string;
};

export function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

export function vistaDesdeFlujoTelegram(flujo: string | undefined): VistaRecepcionBorrador | null {
  if (flujo === 'emergencia_ingreso') return 'emergencia';
  if (flujo === 'nota_entrega_ingreso') return 'nota_entrega';
  if (flujo === 'ingreso_manual') return 'ingreso_manual';
  return null;
}

export function tipoRpcDesdeFlujoTelegram(flujo: string | undefined): TipoRecepcionCampo | null {
  const vista = vistaDesdeFlujoTelegram(flujo);
  if (!vista) return null;
  return vista === 'emergencia' ? 'emergencia' : 'nota_entrega';
}

export function urlRecepcionCampoBorrador(token: string, vista: VistaRecepcionBorrador): string {
  const q = `borrador=${encodeURIComponent(token)}`;
  if (vista === 'emergencia') {
    return `${baseUrlApp()}/almacen/recepcion?tab=emergencia&${q}`;
  }
  if (vista === 'nota_entrega') {
    return `${baseUrlApp()}/almacen/recepcion?tab=nota&${q}`;
  }
  return `${baseUrlApp()}/almacen/recepcion?${q}`;
}

export function nuevoTokenRecepcionCampo(): string {
  return crypto.randomUUID();
}

type MetadataIngresoLike = {
  flujo?: string;
  proveedor_nombre?: string;
  num_doc?: string;
  ubicacion_id?: string;
  ubicacion_nombre?: string;
  observaciones?: string;
  lineas?: Array<{
    material_id: string;
    material_nombre: string;
    unidad: string;
    cantidad: number;
    forma_ingreso?: FormaIngresoRecepcion;
    soporte_storage_path?: string;
    soporte_file_name?: string;
    soporte_mime_type?: string;
  }>;
  soporte_storage_path?: string;
  soporte_file_name?: string;
  soporte_mime_type?: string;
  recepcion_campo_token?: string;
};

export function borradorDesdeEstadoTelegram(
  chatId: string,
  proyectoId: string | null,
  metadata: Record<string, unknown>,
): BorradorRecepcionTelegramPayload | null {
  const m = metadata as MetadataIngresoLike;
  const vista = vistaDesdeFlujoTelegram(m.flujo);
  const tipo = tipoRpcDesdeFlujoTelegram(m.flujo);
  const token = String(m.recepcion_campo_token ?? '').trim();
  if (!vista || !tipo || !token) return null;

  const lineas = (m.lineas ?? []).map((l) => ({
    material_id: String(l.material_id ?? '').trim(),
    nombre: String(l.material_nombre ?? '').trim() || 'Material',
    unidad: String(l.unidad ?? 'UND').trim() || 'UND',
    cantidad: Number(l.cantidad) || 0,
    forma_ingreso: (l.forma_ingreso ?? 'sin_nota') as FormaIngresoRecepcion,
    soporte_storage_path: l.soporte_storage_path?.trim() || null,
    soporte_file_name: l.soporte_file_name?.trim() || null,
    soporte_mime_type: l.soporte_mime_type?.trim() || null,
  }));

  return {
    token,
    vista,
    tipo,
    proyecto_id: proyectoId?.trim() || null,
    ubicacion_id: m.ubicacion_id?.trim() || null,
    proveedor_nombre: m.proveedor_nombre?.trim() || '',
    num_doc: m.num_doc?.trim() || '',
    observaciones: m.observaciones?.trim() || '',
    lineas: lineas.filter((l) => l.material_id && l.cantidad > 0),
    soporte_storage_path: m.soporte_storage_path?.trim() || null,
    soporte_file_name: m.soporte_file_name?.trim() || null,
    soporte_mime_type: m.soporte_mime_type?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export async function buscarEstadoPorTokenRecepcion(
  supabase: SupabaseClient,
  token: string,
): Promise<{ chat_id: string; proyecto_id: string | null; metadata: Record<string, unknown> } | null> {
  const t = token.trim();
  if (!t) return null;

  const { data, error } = await supabase
    .from('ci_telegram_estados')
    .select('chat_id, proyecto_id, metadata')
    .eq(`metadata->>${METADATA_TOKEN_KEY}`, t)
    .maybeSingle();

  if (error?.code === '42P01') return null;
  if (error) throw new Error(error.message);
  if (!data?.chat_id) return null;

  return {
    chat_id: String(data.chat_id),
    proyecto_id: data.proyecto_id ? String(data.proyecto_id) : null,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  };
}

export async function obtenerBorradorRecepcionPorToken(
  supabase: SupabaseClient,
  token: string,
): Promise<BorradorRecepcionTelegramPayload | null> {
  const row = await buscarEstadoPorTokenRecepcion(supabase, token);
  if (!row) return null;
  return borradorDesdeEstadoTelegram(row.chat_id, row.proyecto_id, row.metadata);
}

export async function limpiarBorradorRecepcionPorToken(
  supabase: SupabaseClient,
  token: string,
): Promise<void> {
  const row = await buscarEstadoPorTokenRecepcion(supabase, token);
  if (!row) return;

  const meta = { ...row.metadata };
  delete meta[METADATA_TOKEN_KEY];
  delete meta.recepcion_campo_borrador;

  await supabase
    .from('ci_telegram_estados')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('chat_id', row.chat_id);
}
