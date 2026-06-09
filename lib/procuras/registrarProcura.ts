import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { parseEstadoProcura, type EstadoProcura } from '@/lib/procuras/procuraEstados';
import {
  aplicarSolicitanteEnRow,
  resolverSolicitanteDesdeTelegram,
  resolverSolicitanteDesdeWeb,
  type SolicitanteProcura,
} from '@/lib/procuras/solicitanteProcura';
import { enviarAlertaProcuraPendienteAdmin } from '@/lib/procuras/alertaAdminProcuraTelegram';
import { normalizarUnidadProcura } from '@/lib/procuras/unidadesProcura';

const SELECT_PROCURA_INSERT =
  'id,ticket,estado,material_txt,cantidad,unidad,solicitante_nombre,created_at,updated_at';

const SELECT_PROCURA_INSERT_LEGACY =
  'id,ticket,estado,material_txt,cantidad,unidad,created_at,updated_at';

function esErrorSchemaSolicitanteNombre(msg: string): boolean {
  return /solicitante_nombre|schema cache/i.test(msg);
}

function rowSinSolicitanteNombre(row: Record<string, unknown>): Record<string, unknown> {
  const { solicitante_nombre: _omit, ...rest } = row;
  return rest;
}

export type InsertarProcuraParams = {
  material_id?: string | null;
  material_txt: string;
  cantidad: number;
  unidad?: string | null;
  proyecto_id?: string | null;
  entidad_id?: string | null;
  ubicacion_destino_id?: string | null;
  estado?: EstadoProcura | string | null;
  observaciones?: string | null;
  solicitante?: SolicitanteProcura;
  solicitante_telegram_chat_id?: number | null;
  solicitante_empleado_id?: string | null;
  solicitante_nombre?: string | null;
  asignado_telegram_chat_id?: number | string | null;
};

export async function insertarProcura(
  supabase: SupabaseClient,
  params: InsertarProcuraParams,
  opts?: { origen?: 'web' | 'telegram'; telegram_chat_id?: string | number },
): Promise<{ data: Record<string, unknown>; error: Error | null }> {
  let materialTxt = params.material_txt.trim();
  const materialId = params.material_id?.trim() || null;
  const cantidad = params.cantidad;
  const proyectoId = params.proyecto_id?.trim() || null;
  const entidadId = params.entidad_id?.trim() || null;

  if (materialId && !materialTxt) {
    const { data: mat } = await supabase
      .from('global_inventory')
      .select('name,sap_code')
      .eq('id', materialId)
      .maybeSingle();
    if (mat?.name) {
      const nombre = String(mat.name).trim();
      const sku = mat.sap_code?.trim();
      materialTxt = sku ? `${nombre} (${sku})` : nombre;
    }
  }

  if (!materialTxt) {
    return { data: {}, error: new Error('Indique la descripción del material.') };
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { data: {}, error: new Error('Cantidad inválida.') };
  }
  if (!proyectoId && !entidadId) {
    return { data: {}, error: new Error('Indique proyecto u entidad para la procura.') };
  }

  let solicitante = params.solicitante;
  if (!solicitante) {
    try {
      if (opts?.origen === 'telegram' && opts.telegram_chat_id != null) {
        solicitante = await resolverSolicitanteDesdeTelegram(supabase, opts.telegram_chat_id);
      } else {
        solicitante = await resolverSolicitanteDesdeWeb(supabase, {
          solicitante_empleado_id: params.solicitante_empleado_id,
          solicitante_nombre: params.solicitante_nombre,
          solicitante_telegram_chat_id: params.solicitante_telegram_chat_id,
        });
      }
    } catch (e) {
      return { data: {}, error: e instanceof Error ? e : new Error('Solicitante inválido') };
    }
  }

  const estado = parseEstadoProcura(params.estado) ?? 'solicitada';
  const entidadResuelta =
    entidadId ?? (proyectoId ? await resolverEntidadIdDesdeProyecto(supabase, proyectoId) : null);

  const row: Record<string, unknown> = {
    material_txt: materialTxt.slice(0, 500),
    cantidad,
    unidad: normalizarUnidadProcura(params.unidad),
    estado,
    observaciones: params.observaciones?.trim()?.slice(0, 2000) || null,
  };

  if (proyectoId) row.proyecto_id = proyectoId;
  if (entidadResuelta) row.entidad_id = entidadResuelta;
  if (materialId) row.material_id = materialId;
  if (params.ubicacion_destino_id?.trim()) {
    row.ubicacion_destino_id = params.ubicacion_destino_id.trim();
  }

  const asignadoChat = Number(params.asignado_telegram_chat_id);
  if (Number.isFinite(asignadoChat) && asignadoChat > 0) {
    row.asignado_telegram_chat_id = Math.trunc(asignadoChat);
  }

  aplicarSolicitanteEnRow(row, solicitante);

  let { data, error } = await supabase
    .from('ci_procuras')
    .insert(row as never)
    .select(SELECT_PROCURA_INSERT)
    .single();

  if (error && esErrorSchemaSolicitanteNombre(error.message)) {
    ({ data, error } = await supabase
      .from('ci_procuras')
      .insert(rowSinSolicitanteNombre(row) as never)
      .select(SELECT_PROCURA_INSERT_LEGACY)
      .single());
  }

  if (error) {
    const hint = esErrorSchemaSolicitanteNombre(error.message)
      ? ' En Supabase SQL Editor: notify pgrst, \'reload schema\';'
      : '';
    return { data: {}, error: new Error(`${error.message}${hint}`) };
  }

  const out = (data ?? {}) as Record<string, unknown>;
  if (!out.solicitante_nombre && solicitante.nombre) {
    out.solicitante_nombre = solicitante.nombre;
  }

  if (estado === 'solicitada' && out.id) {
    void enviarAlertaProcuraPendienteAdmin(supabase, String(out.id)).catch((e) => {
      console.warn('[insertarProcura] alerta admin', e);
    });
  }

  return { data: out, error: null };
}
