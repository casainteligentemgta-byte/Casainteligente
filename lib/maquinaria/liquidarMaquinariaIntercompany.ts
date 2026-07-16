import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';

export type LiquidarMaquinariaInput = {
  proyectoId: string;
  periodoDesde: string;
  periodoHasta: string;
  tasaBcv: number;
};

export type LiquidacionMaquinariaItem = {
  id: string;
  entidad_destino_id: string;
  monto_total_usd: number;
  lineas: number;
};

export type ResultadoLiquidarMaquinaria =
  | {
      success: true;
      liquidaciones: LiquidacionMaquinariaItem[];
      montoLiquidadoUsd: number;
      lineasProcesadas: number;
    }
  | {
      success: false;
      message: string;
      lineasProcesadas: 0;
    };

type RpcPayload = {
  success?: boolean;
  message?: string;
  liquidaciones?: LiquidacionMaquinariaItem[];
  monto_liquidado_usd?: number;
  lineas_procesadas?: number;
};

async function resolverEntidadEjecutora(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ci_contratos_express')
    .select('entidad_ejecutora_id')
    .eq('proyecto_id', proyectoId)
    .eq('tipo_contrato', 'administracion_delegada')
    .in('estado', ['exitoso', 'registrado'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.entidad_ejecutora_id ?? null;
}

export async function liquidarMaquinariaIntercompany(
  supabase: SupabaseClient,
  input: LiquidarMaquinariaInput,
): Promise<ResultadoLiquidarMaquinaria> {
  const proyectoId = input.proyectoId.trim();
  const periodoDesde = input.periodoDesde.trim();
  const periodoHasta = input.periodoHasta.trim();
  const tasaBcv = Number(input.tasaBcv);

  if (!isValidProyectoUuid(proyectoId)) {
    throw new Error('proyectoId inválido');
  }
  if (!periodoDesde || !periodoHasta) {
    throw new Error('Faltan fechas del periodo de liquidación');
  }
  if (!(tasaBcv > 0)) {
    throw new Error('tasaBcv inválida');
  }

  const entidadOrigenId = await resolverEntidadEjecutora(supabase, proyectoId);
  if (!entidadOrigenId) {
    throw new Error(
      'No se pudo determinar la entidad responsable de la ejecución del proyecto (contrato AD).',
    );
  }

  const { data, error } = await supabase.rpc('ci_liquidar_maquinaria_intercompany', {
    p_proyecto_id: proyectoId,
    p_periodo_desde: periodoDesde,
    p_periodo_hasta: periodoHasta,
    p_tasa_bcv: tasaBcv,
    p_entidad_origen_id: entidadOrigenId,
  });

  if (error) {
    if (error.code === '42883' || /ci_liquidar_maquinaria_intercompany/i.test(error.message ?? '')) {
      throw new Error('Migración 191 pendiente en Supabase (liquidaciones maquinaria).');
    }
    throw error;
  }

  const payload = (data ?? {}) as RpcPayload;
  const lineas = Number(payload.lineas_procesadas ?? 0);

  if (!payload.success) {
    return {
      success: false,
      message:
        payload.message ??
        'No existen horas de maquinaria pendientes por liquidar en este ciclo.',
      lineasProcesadas: 0,
    };
  }

  return {
    success: true,
    liquidaciones: payload.liquidaciones ?? [],
    montoLiquidadoUsd: Number(payload.monto_liquidado_usd ?? 0),
    lineasProcesadas: lineas,
  };
}
