import type { SupabaseClient } from '@supabase/supabase-js';
import { documentoDesdeBudget, type DocumentoPresupuestoCliente } from './documentoCliente';
import { obtenerTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

export async function tasaBcvDocumento(
  supabase: SupabaseClient,
): Promise<{ tasa: number | null; fecha: string | null }> {
  const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  try {
    const r = await obtenerTasaBcvVesPorUsd(fecha, { supabase });
    return { tasa: r.tasa_bcv_ves_por_usd, fecha: r.fecha || fecha };
  } catch {
    return { tasa: null, fecha };
  }
}

export async function documentoClienteDesdeId(
  supabase: SupabaseClient,
  budgetId: string,
): Promise<
  | { ok: true; doc: DocumentoPresupuestoCliente; budget: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const { data: budget, error } = await supabase.from('budgets').select('*').eq('id', budgetId).maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!budget) return { ok: false, error: 'Presupuesto no encontrado', status: 404 };

  const row = budget as Record<string, unknown>;
  let telefono = '';
  let email = '';
  let direccion = '';
  const cid = typeof row.customer_id === 'string' ? row.customer_id : '';
  if (cid) {
    const { data: c } = await supabase
      .from('customers')
      .select('movil, telefono, email, direccion')
      .eq('id', cid)
      .maybeSingle();
    if (c) {
      const rowC = c as { movil?: string; telefono?: string; email?: string; direccion?: string };
      telefono = String(rowC.movil || rowC.telefono || '');
      email = String(rowC.email ?? '');
      direccion = String(rowC.direccion ?? '');
    }
  }

  const bcv = await tasaBcvDocumento(supabase);
  const doc = documentoDesdeBudget(row, {
    telefono,
    email,
    direccion,
    tasaBcv: bcv.tasa,
    tasaBcvFecha: bcv.fecha,
  });
  return { ok: true, doc, budget: row };
}
