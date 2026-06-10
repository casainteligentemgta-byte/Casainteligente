import type { SupabaseClient } from '@supabase/supabase-js';
import {
  limpiarContabilidadRecepcionPendiente,
  marcarContabilidadRecepcionPendiente,
} from '@/lib/contabilidad/contabilidadRecepcionCampoSync';
import {
  registrarCompraDesdeIngresoManualFactura,
  type LineaIngresoManualFacturaContabilidad,
  type TipoRecepcionCampoContabilidad,
} from '@/lib/contabilidad/registrarCompraDesdeIngresoManualFactura';

export type SincronizarContabilidadRecepcionParams = {
  recepcionCampoId: string;
  proyectoId: string;
  ubicacionId: string;
  entidadId?: string | null;
  proveedorNombre: string;
  numDoc: string;
  tipoRecepcion: TipoRecepcionCampoContabilidad;
  lineas: LineaIngresoManualFacturaContabilidad[];
  soporteStoragePath?: string | null;
};

/** Puente almacén → contabilidad tras ci_registrar_ingreso_manual_campo (sin duplicar stock). */
export async function sincronizarContabilidadDesdeRecepcionCampo(
  supabase: SupabaseClient,
  params: SincronizarContabilidadRecepcionParams,
) {
  const result = await registrarCompraDesdeIngresoManualFactura(supabase, {
    recepcionCampoId: params.recepcionCampoId,
    proyectoId: params.proyectoId,
    ubicacionId: params.ubicacionId,
    entidadId: params.entidadId,
    proveedorNombre: params.proveedorNombre,
    numDoc: params.numDoc,
    tipoRecepcion: params.tipoRecepcion,
    lineas: params.lineas,
    soporteStoragePath: params.soporteStoragePath,
  });

  if (result.ok) {
    await limpiarContabilidadRecepcionPendiente(supabase, params.recepcionCampoId);
  } else {
    await marcarContabilidadRecepcionPendiente(
      supabase,
      params.recepcionCampoId,
      result.error,
    );
  }

  return result;
}
