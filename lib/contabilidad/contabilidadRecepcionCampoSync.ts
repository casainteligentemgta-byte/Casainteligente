import type { SupabaseClient } from '@supabase/supabase-js';
import {
  registrarCompraDesdeIngresoManualFactura,
  type LineaIngresoManualFacturaContabilidad,
  type TipoRecepcionCampoContabilidad,
} from '@/lib/contabilidad/registrarCompraDesdeIngresoManualFactura';

function esColumnaSyncPendienteAusente(msg: string): boolean {
  return /contabilidad_sync_|42703|schema cache/i.test(msg);
}

/** Marca recepción con stock OK pero contabilidad pendiente (D-08). */
export async function marcarContabilidadRecepcionPendiente(
  supabase: SupabaseClient,
  recepcionId: string,
  error: string,
): Promise<void> {
  const now = new Date().toISOString();
  let intentos = 1;
  const { data: prev } = await supabase
    .from('ci_recepciones_campo')
    .select('contabilidad_sync_intentos')
    .eq('id', recepcionId)
    .maybeSingle();
  if (prev && Number.isFinite(Number(prev.contabilidad_sync_intentos))) {
    intentos = Number(prev.contabilidad_sync_intentos) + 1;
  }

  const { error: updErr } = await supabase
    .from('ci_recepciones_campo')
    .update({
      contabilidad_sync_pendiente: true,
      contabilidad_sync_error: error.slice(0, 2000),
      contabilidad_sync_intentos: intentos,
      contabilidad_sync_at: now,
      updated_at: now,
    } as never)
    .eq('id', recepcionId);

  if (updErr && !esColumnaSyncPendienteAusente(updErr.message ?? '')) {
    console.warn('[contabilidadRecepcionCampoSync] marcar pendiente:', updErr.message);
  }
}

/** Limpia flags de sync pendiente tras éxito contable (D-08). */
export async function limpiarContabilidadRecepcionPendiente(
  supabase: SupabaseClient,
  recepcionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ci_recepciones_campo')
    .update({
      contabilidad_sync_pendiente: false,
      contabilidad_sync_error: null,
      contabilidad_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', recepcionId);

  if (error && !esColumnaSyncPendienteAusente(error.message ?? '')) {
    console.warn('[contabilidadRecepcionCampoSync] limpiar pendiente:', error.message);
  }
}

type RecepcionCampoRow = {
  id: string;
  proyecto_id: string;
  ubicacion_id: string;
  tipo: string;
  num_doc: string | null;
  proveedor_nombre: string | null;
  procura_id: string | null;
  soporte_storage_path: string | null;
  contabilidad_compra_id: string | null;
  contabilidad_sync_pendiente?: boolean;
};

async function cargarRecepcionParaSync(
  supabase: SupabaseClient,
  recepcionId: string,
): Promise<RecepcionCampoRow | null> {
  const { data, error } = await supabase
    .from('ci_recepciones_campo')
    .select(
      'id, proyecto_id, ubicacion_id, tipo, num_doc, proveedor_nombre, procura_id, soporte_storage_path, contabilidad_compra_id, contabilidad_sync_pendiente',
    )
    .eq('id', recepcionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as RecepcionCampoRow | null;
}

async function cargarLineasRecepcion(
  supabase: SupabaseClient,
  recepcionId: string,
): Promise<LineaIngresoManualFacturaContabilidad[]> {
  const { data, error } = await supabase
    .from('ci_recepciones_campo_lineas')
    .select('material_id, cantidad, unidad, descripcion')
    .eq('recepcion_id', recepcionId)
    .order('orden', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((l) => ({
      material_id: String(l.material_id ?? '').trim(),
      material_nombre: String(l.descripcion ?? '').trim() || 'Material',
      unidad: String(l.unidad ?? 'UND').trim() || 'UND',
      cantidad: Number(l.cantidad),
    }))
    .filter((l) => l.material_id && Number.isFinite(l.cantidad) && l.cantidad > 0);
}

export type ResultadoReintentoContabilidadRecepcion =
  | { ok: true; compraId: string; yaExistia: boolean; provisional?: boolean }
  | { ok: false; error: string; yaSincronizada?: boolean };

/** Reintenta sync contable desde datos persistidos de la recepción (D-08). */
export async function reintentarContabilidadRecepcionCampo(
  supabase: SupabaseClient,
  recepcionId: string,
): Promise<ResultadoReintentoContabilidadRecepcion> {
  const recepcion = await cargarRecepcionParaSync(supabase, recepcionId);
  if (!recepcion) {
    return { ok: false, error: 'Recepción no encontrada.' };
  }

  if (recepcion.contabilidad_compra_id?.trim()) {
    await limpiarContabilidadRecepcionPendiente(supabase, recepcionId);
    return {
      ok: false,
      error: 'La recepción ya tiene compra contable vinculada.',
      yaSincronizada: true,
    };
  }

  const lineas = await cargarLineasRecepcion(supabase, recepcionId);
  if (!lineas.length) {
    return { ok: false, error: 'La recepción no tiene líneas válidas.' };
  }

  const tipo = String(recepcion.tipo ?? 'factura_canal').trim() as TipoRecepcionCampoContabilidad;
  const tiposValidos = new Set(['factura_canal', 'nota_entrega', 'emergencia']);
  const tipoRecepcion = tiposValidos.has(tipo) ? tipo : 'factura_canal';

  const result = await registrarCompraDesdeIngresoManualFactura(supabase, {
    recepcionCampoId: recepcionId,
    proyectoId: recepcion.proyecto_id,
    ubicacionId: recepcion.ubicacion_id,
    proveedorNombre: recepcion.proveedor_nombre?.trim() || 'Proveedor',
    numDoc: recepcion.num_doc?.trim() || 'S/N',
    tipoRecepcion,
    lineas,
    soporteStoragePath: recepcion.soporte_storage_path,
  });

  if (result.ok) {
    await limpiarContabilidadRecepcionPendiente(supabase, recepcionId);
    return {
      ok: true,
      compraId: result.compraId,
      yaExistia: result.yaExistia,
      provisional: result.provisional,
    };
  }

  await marcarContabilidadRecepcionPendiente(supabase, recepcionId, result.error);
  return { ok: false, error: result.error };
}
