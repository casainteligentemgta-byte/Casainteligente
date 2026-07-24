import type { SupabaseClient } from '@supabase/supabase-js';
import { esCargoGastoAdministrativo } from '@/lib/nomina/clasificarCargoNomina';
import {
  calcularEficienciaAdOficina,
  calcularHonorariosAdUsd,
  costoMensualCargoVes,
  debeBloquearDescuentosNexus,
  type FilaHonorarioAd,
  UMBRAL_BLOQUEO_DESCUENTO_NEXUS,
} from '@/lib/nomina/calcularEficienciaAdOficina';

type NominaRow = {
  cargo_codigo: string | null;
  salario_base_mensual: number;
  factor_prestacional: number;
  cestaticket_mensual: number;
};

export type AuditoriaEficienciaAd = {
  ratio_eficiencia: number;
  bloquear_descuentos_nexus: boolean;
  honorarios_ad_usd: number;
  nomina_oficina_usd: number;
  nomina_oficina_ves: number;
  umbral_pct: number;
  proyectos_con_ad: number;
  eficiente: boolean;
};

async function cargarHonorariosAd(supabase: SupabaseClient): Promise<FilaHonorarioAd[]> {
  const { data: contratos, error: errC } = await supabase
    .from('ci_contratos_express')
    .select('proyecto_id, honorarios_admin_pct')
    .eq('tipo_contrato', 'administracion_delegada')
    .eq('estado', 'exitoso');

  if (errC) throw errC;

  const ids = Array.from(
    new Set((contratos ?? []).map((c) => String((c as { proyecto_id: string }).proyecto_id))),
  );
  if (!ids.length) return [];

  const { data: fondos, error: errF } = await supabase
    .from('ci_proyecto_fondos')
    .select('proyecto_id, total_abonado_usd')
    .in('proyecto_id', ids);

  if (errF) throw errF;

  const pctPorProyecto = new Map<string, number>();
  for (const c of contratos ?? []) {
    const pid = String((c as { proyecto_id: string }).proyecto_id);
    const pct = Number((c as { honorarios_admin_pct?: unknown }).honorarios_admin_pct) || 0;
    pctPorProyecto.set(pid, pct);
  }

  return (fondos ?? []).map((f) => ({
    proyecto_id: String((f as { proyecto_id: string }).proyecto_id),
    total_abonado_usd: Number((f as { total_abonado_usd?: unknown }).total_abonado_usd) || 0,
    honorarios_admin_pct: pctPorProyecto.get(String((f as { proyecto_id: string }).proyecto_id)) ?? 0,
  }));
}

async function cargarNominaOficinaVes(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('ci_config_nomina')
    .select('cargo_codigo, salario_base_mensual, factor_prestacional, cestaticket_mensual');

  if (error) throw error;

  return (data ?? [])
    .filter((r) => esCargoGastoAdministrativo((r as NominaRow).cargo_codigo))
    .reduce(
      (acc, r) =>
        acc +
        costoMensualCargoVes(
          Number((r as NominaRow).salario_base_mensual) || 0,
          Number((r as NominaRow).factor_prestacional) || 0,
          Number((r as NominaRow).cestaticket_mensual) || 0,
        ),
      0,
    );
}

/** Auditoría operativa AD vs nómina oficina (candado comercial Nexus). */
export async function auditarEficienciaAdOficina(
  supabase: SupabaseClient,
  tasaBcv: number | null,
): Promise<AuditoriaEficienciaAd> {
  const [honorariosFilas, nominaOficinaVes] = await Promise.all([
    cargarHonorariosAd(supabase),
    cargarNominaOficinaVes(supabase),
  ]);

  const honorariosAdUsd = calcularHonorariosAdUsd(honorariosFilas);
  const resultado = calcularEficienciaAdOficina(honorariosAdUsd, nominaOficinaVes, tasaBcv);
  const ratio = resultado.ratioEficienciaPct;

  return {
    ratio_eficiencia: ratio,
    bloquear_descuentos_nexus: debeBloquearDescuentosNexus(ratio),
    honorarios_ad_usd: resultado.honorariosAdUsd,
    nomina_oficina_usd: resultado.nominaOficinaUsd,
    nomina_oficina_ves: resultado.nominaOficinaVes,
    umbral_pct: UMBRAL_BLOQUEO_DESCUENTO_NEXUS,
    proyectos_con_ad: honorariosFilas.length,
    eficiente: resultado.eficiente,
  };
}
