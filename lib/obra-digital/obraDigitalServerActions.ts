'use server';

/**
 * Server actions del expediente obra-digital (fuera de `app/…/expediente/` para evitar
 * conflictos de bundling webpack con la ruta dinámica `[contractId]`).
 *
 * Integración nómina (`ci_config_nomina`, etc.): fase posterior.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type InsertarDocumentoInput = {
  contractId: string;
  docType: string;
  storagePath: string;
  escaneoFirmaVisible: boolean;
  escaneoHuellaVisible: boolean;
  referenceMonth?: number | null;
  referenceYear?: number | null;
  referenceWeek?: number | null;
};

export async function insertarDocumentoObraDigital(input: InsertarDocumentoInput) {
  const supabase = await createClient();
  const row: Record<string, unknown> = {
    contract_id: input.contractId,
    doc_type: input.docType,
    storage_path: input.storagePath.trim(),
    escaneo_firma_visible: input.escaneoFirmaVisible,
    escaneo_huella_visible: input.escaneoHuellaVisible,
  };
  if (input.docType === 'ANTICIPO_MENSUAL') {
    row.reference_month = input.referenceMonth ?? null;
    row.reference_year = input.referenceYear ?? null;
  }
  if (input.docType === 'LIBRO_OBRA_SEMANAL') {
    row.reference_month = input.referenceMonth ?? null;
    row.reference_year = input.referenceYear ?? null;
    row.reference_week = input.referenceWeek ?? null;
  }

  const { error } = await supabase.from('obra_digital_documents').insert(row);
  if (error) {
    return { ok: false as const, message: error.message };
  }
  revalidatePath(`/obra-digital/expediente/${input.contractId}`);
  revalidatePath('/obra-digital');
  return { ok: true as const };
}

export async function actualizarCotejoDocumento(input: {
  documentId: string;
  contractId: string;
  escaneoFirmaVisible: boolean;
  escaneoHuellaVisible: boolean;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('obra_digital_documents')
    .update({
      escaneo_firma_visible: input.escaneoFirmaVisible,
      escaneo_huella_visible: input.escaneoHuellaVisible,
    })
    .eq('id', input.documentId)
    .eq('contract_id', input.contractId);

  if (error) {
    return { ok: false as const, message: error.message };
  }
  revalidatePath(`/obra-digital/expediente/${input.contractId}`);
  return { ok: true as const };
}

export async function agregarHerramientaObraDigital(input: {
  contractId: string;
  toolName: string;
  serialNumber: string;
  replacementValue: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from('obra_digital_tool_assignments').insert({
    contract_id: input.contractId,
    tool_name: input.toolName.trim(),
    serial_number: input.serialNumber.trim(),
    replacement_value: input.replacementValue.replace(',', '.') || '0',
    status: 'BAJO_CUSTODIA',
  });
  if (error) return { ok: false as const, message: error.message };
  revalidatePath(`/obra-digital/expediente/${input.contractId}`);
  return { ok: true as const };
}

export async function registrarRendimientoDiario(input: {
  contractId: string;
  workDate: string;
  physicalAdvance: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from('obra_digital_daily_progress').upsert(
    {
      contract_id: input.contractId,
      work_date: input.workDate,
      physical_advance: input.physicalAdvance.replace(',', '.'),
    },
    { onConflict: 'contract_id,work_date', ignoreDuplicates: false },
  );
  if (error) return { ok: false as const, message: error.message };
  revalidatePath(`/obra-digital/expediente/${input.contractId}`);
  return { ok: true as const };
}

export async function upsertAnticipoMensualObraDigital(input: {
  contractId: string;
  month: number;
  year: number;
  calculatedAccrued: string;
}) {
  const supabase = await createClient();
  const accrued = Number.parseFloat(input.calculatedAccrued.replace(',', '.'));
  if (!Number.isFinite(accrued) || accrued < 0) {
    return { ok: false as const, message: 'Monto acumulado inválido' };
  }
  const max75 = Math.round(accrued * 0.75 * 100) / 100;

  const { data: ex, error: e0 } = await supabase
    .from('obra_digital_monthly_advances')
    .select('id,status')
    .eq('contract_id', input.contractId)
    .eq('month', input.month)
    .eq('year', input.year)
    .maybeSingle();

  if (e0) return { ok: false as const, message: e0.message };

  const row = ex as { id: string; status: string } | null;
  if (!row) {
    const { error } = await supabase.from('obra_digital_monthly_advances').insert({
      contract_id: input.contractId,
      month: input.month,
      year: input.year,
      calculated_accrued: accrued,
      max_advance_allowed: max75,
      status: 'PAGO_BLOQUEADO',
    });
    if (error) return { ok: false as const, message: error.message };
  } else if (row.status === 'PAGO_BLOQUEADO') {
    const { error } = await supabase
      .from('obra_digital_monthly_advances')
      .update({
        calculated_accrued: accrued,
        max_advance_allowed: max75,
      })
      .eq('id', row.id);
    if (error) return { ok: false as const, message: error.message };
  } else {
    return {
      ok: false as const,
      message: 'No se recalcula un anticipo ya listo para pago o pagado.',
    };
  }

  revalidatePath(`/obra-digital/expediente/${input.contractId}`);
  return { ok: true as const };
}

export async function calcularAnticipoDesdeRendimiento(contractId: string, month: number, year: number) {
  const supabase = await createClient();
  const { data: c, error: ec } = await supabase
    .from('obra_digital_labor_contracts')
    .select('salary_per_day')
    .eq('id', contractId)
    .maybeSingle();
  if (ec) return { ok: false as const, message: ec.message };
  if (!c) return { ok: false as const, message: 'Contrato no encontrado' };

  const salary = Number.parseFloat(String((c as { salary_per_day: string }).salary_per_day));
  if (!Number.isFinite(salary) || salary <= 0) {
    return { ok: false as const, message: 'Salario diario inválido' };
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${year}-${pad(month)}-01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${String(last).padStart(2, '0')}`;

  const { data: rows, error: er } = await supabase
    .from('obra_digital_daily_progress')
    .select('physical_advance')
    .eq('contract_id', contractId)
    .gte('work_date', start)
    .lte('work_date', end);

  if (er) return { ok: false as const, message: er.message };

  let sum = 0;
  for (const r of rows ?? []) {
    sum += Number.parseFloat(String((r as { physical_advance: string }).physical_advance));
  }
  const accrued = Math.round(sum * salary * 100) / 100;
  return upsertAnticipoMensualObraDigital({
    contractId,
    month,
    year,
    calculatedAccrued: String(accrued),
  });
}

export async function pasarContratoALiquidacion(contractId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('obra_digital_labor_contracts')
    .update({ contract_status: 'LIQUIDACION' })
    .eq('id', contractId)
    .eq('contract_status', 'ACTIVO');
  if (error) return { ok: false as const, message: error.message };
  revalidatePath(`/obra-digital/expediente/${contractId}`);
  return { ok: true as const };
}

export async function cerrarContratoHistorico(contractId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('obra_digital_labor_contracts')
    .update({ contract_status: 'CERRADO_HISTORICO' })
    .eq('id', contractId)
    .eq('contract_status', 'LIQUIDACION');
  if (error) return { ok: false as const, message: error.message };
  revalidatePath(`/obra-digital/expediente/${contractId}`);
  return { ok: true as const };
}

export async function avanzarAnticipoAListoParaPago(contractId: string, month: number, year: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('obra_digital_monthly_advances')
    .update({ status: 'LISTO_PARA_PAGO' })
    .eq('contract_id', contractId)
    .eq('month', month)
    .eq('year', year)
    .eq('status', 'PAGO_BLOQUEADO');
  if (error) return { ok: false as const, message: error.message };
  revalidatePath(`/obra-digital/expediente/${contractId}`);
  return { ok: true as const };
}

export async function marcarAnticipoPagado(contractId: string, month: number, year: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('obra_digital_monthly_advances')
    .update({ status: 'PAGADO' })
    .eq('contract_id', contractId)
    .eq('month', month)
    .eq('year', year)
    .eq('status', 'LISTO_PARA_PAGO');
  if (error) return { ok: false as const, message: error.message };
  revalidatePath(`/obra-digital/expediente/${contractId}`);
  return { ok: true as const };
}
