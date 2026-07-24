/**
 * Pasivo laboral por trabajador — Supabase + LaborCalculator.
 * Lee workers, benefit_configs y salary_history (migración 270).
 * Arts. 131 (utilidades), 190 (bono), 142 (garantía / retroactivo / monto mayor).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LaborCalculator,
  type AdvertenciaCalculo,
  type PasoAuditoriaCalculo,
} from '@/lib/legal/calcularPrestacionAntiguedad';

export type WorkerPasivoResult = {
  worker: string | null;
  worker_id: string;
  salario_base_mensual: number;
  salario_effective_date: string | null;
  dias_utilidades: number;
  dias_bono_vacacional: number;
  fecha_inicio: string;
  fecha_fin: string;
  salario_integral_diario: number;
  garantia_trimestral: number;
  retroactivo_acumulado: number;
  /** Art. 142 LOTTT — provisionar el monto mayor */
  monto_a_provisionar: number;
  criterio_provision: 'garantia_trimestral' | 'retroactivo' | 'empatados';
  anios_servicio?: number;
  fraccion_superior_seis_meses?: boolean;
  auditoria: PasoAuditoriaCalculo[];
  advertencias: AdvertenciaCalculo[];
  metodo: 'deterministico_lott_142';
  version_formula: string;
  referencias: {
    utilidades: string;
    bono_vacacional: string;
    garantia_y_retroactivo: string;
  };
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function calculateWorkerPasivo(
  supabase: SupabaseClient,
  workerId: string,
  options?: { fechaFin?: string | null },
): Promise<WorkerPasivoResult | { error: string }> {
  const id = workerId.trim();
  if (!id) return { error: 'worker_id requerido' };

  const { data: worker, error: wErr } = await supabase
    .from('workers')
    .select('id, full_name, join_date')
    .eq('id', id)
    .maybeSingle();

  if (wErr) {
    const hint =
      wErr.message.includes('schema cache') || wErr.message.includes('join_date')
        ? ' Ejecute supabase/migrations/270_ci_labor_pasivo_trabajador.sql en Supabase.'
        : '';
    return { error: `${wErr.message}.${hint}`.trim() };
  }
  if (!worker) return { error: 'Error: No se encontró el trabajador.' };

  const { data: config } = await supabase
    .from('benefit_configs')
    .select('days_utilidades, days_bono_vacacional')
    .eq('worker_id', id)
    .maybeSingle();

  const { data: salaryRows, error: sErr } = await supabase
    .from('salary_history')
    .select('base_salary, effective_date')
    .eq('worker_id', id)
    .order('effective_date', { ascending: false })
    .limit(1);

  if (sErr) {
    const hint =
      sErr.message.includes('schema cache') || sErr.message.includes('does not exist')
        ? ' Ejecute migración 270 (salary_history / ci_labor_salary_history).'
        : '';
    return { error: `${sErr.message}.${hint}`.trim() };
  }
  const latestSalary = salaryRows?.[0];
  if (!latestSalary || latestSalary.base_salary == null) {
    return {
      error:
        'Error: No se encontró historial salarial para este trabajador. Inserte fila en salary_history.',
    };
  }

  const diasUtilidades = Number(config?.days_utilidades ?? 30);
  const diasBono = Number(config?.days_bono_vacacional ?? 15);
  const joinDate = String(worker.join_date ?? '').slice(0, 10);
  if (!joinDate) {
    return { error: 'Error: El trabajador no tiene join_date / fecha de ingreso.' };
  }

  const fechaFin = (options?.fechaFin || todayIso()).slice(0, 10);

  try {
    const calc = new LaborCalculator(
      Number(latestSalary.base_salary),
      diasUtilidades,
      diasBono,
    );
    const todo = calc.calcularTodo(joinDate, fechaFin);
    const trimestral = todo.garantia_trimestral;
    const retroactivo = todo.retroactivo?.retroactivo ?? 0;

    return {
      worker: worker.full_name ?? null,
      worker_id: id,
      salario_base_mensual: Number(latestSalary.base_salary),
      salario_effective_date: latestSalary.effective_date
        ? String(latestSalary.effective_date).slice(0, 10)
        : null,
      dias_utilidades: diasUtilidades,
      dias_bono_vacacional: diasBono,
      fecha_inicio: joinDate,
      fecha_fin: fechaFin,
      salario_integral_diario: todo.salario_integral_diario,
      garantia_trimestral: trimestral,
      retroactivo_acumulado: round2(retroactivo),
      monto_a_provisionar: todo.monto_a_provisionar,
      criterio_provision: todo.criterio_provision,
      anios_servicio: todo.retroactivo?.anios_servicio,
      fraccion_superior_seis_meses: todo.retroactivo?.fraccion_superior_seis_meses,
      auditoria: todo.auditoria,
      advertencias: todo.advertencias,
      metodo: todo.metodo,
      version_formula: todo.version_formula,
      referencias: {
        utilidades: 'Art. 131 LOTTT',
        bono_vacacional: 'Art. 190 LOTTT',
        garantia_y_retroactivo: 'Art. 142 LOTTT',
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
