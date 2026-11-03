import type { SupabaseClient } from '@supabase/supabase-js';
import {
  etiquetaMetodoAbono,
  redondearUsd,
  type BudgetAbono,
} from '@/lib/presupuesto/cobros';

export type OrigenCobroCliente = 'presupuesto' | 'obra';

export type CobroCliente = {
  id: string;
  fecha: string;
  monto: number;
  moneda: string;
  metodo: string;
  origen: OrigenCobroCliente;
  etiquetaOrigen: string;
};

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function fechaDe(v: unknown): string {
  const s = texto(v);
  return s || '';
}

export function normalizarAbonoPresupuesto(row: unknown, etiqueta = 'Presupuesto'): CobroCliente | null {
  const r = (row ?? {}) as Record<string, unknown>;
  const id = texto(r.id);
  if (!id) return null;
  const moneda = texto(r.moneda).toUpperCase() || 'USD';
  const monto = moneda === 'VES' ? numero(r.monto) : numero(r.monto_usd ?? r.monto);
  const fecha = fechaDe(r.fecha_abono) || fechaDe(r.created_at);
  if (!fecha || monto <= 0) return null;
  return {
    id: `presupuesto:${id}`,
    fecha,
    monto: redondearUsd(monto),
    moneda,
    metodo: etiquetaMetodoAbono(texto(r.metodo)),
    origen: 'presupuesto',
    etiquetaOrigen: etiqueta,
  };
}

export function normalizarAbonoObra(row: unknown, etiquetaObra?: string | null): CobroCliente | null {
  const r = (row ?? {}) as Record<string, unknown>;
  const id = texto(r.id);
  if (!id) return null;
  const moneda = texto(r.moneda).toUpperCase() || 'USD';
  const monto =
    moneda === 'VES'
      ? numero(r.monto_recibido ?? r.monto)
      : numero(r.monto_usd ?? r.monto_equivalente_usd ?? r.monto_recibido ?? r.monto);
  const fecha = fechaDe(r.fecha_abono) || fechaDe(r.created_at);
  if (!fecha || monto <= 0) return null;
  const banco = texto(r.banco_origen);
  return {
    id: `obra:${id}`,
    fecha,
    monto: redondearUsd(monto),
    moneda,
    metodo: banco ? `Transferencia · ${banco}` : etiquetaMetodoAbono('transferencia'),
    origen: 'obra',
    etiquetaOrigen: etiquetaObra?.trim() || 'Obra',
  };
}

export function unirCobrosCliente(filas: CobroCliente[]): CobroCliente[] {
  return [...filas].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

function sumaAbonosPorBudget(abonos: BudgetAbono[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of abonos) {
    const bid = String(a.budget_id ?? '').trim();
    if (!bid) continue;
    map.set(bid, redondearUsd((map.get(bid) ?? 0) + numero(a.monto_usd)));
  }
  return map;
}

/**
 * Suma de abonos reales (USD) por presupuesto. Si la tabla no existe, mapa vacío.
 */
export async function cargarMontoPagadoPorPresupuesto(
  supabase: SupabaseClient,
  budgetIds: string[],
): Promise<Map<string, number>> {
  const ids = budgetIds.map((x) => x.trim()).filter(Boolean);
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from('budget_abonos')
    .select('id,budget_id,monto_usd')
    .in('budget_id', ids);
  if (error) return new Map();
  return sumaAbonosPorBudget((data ?? []) as BudgetAbono[]);
}

export async function cargarCobrosCliente(
  supabase: SupabaseClient,
  customerId: string,
): Promise<{ cobros: CobroCliente[]; error: string | null }> {
  const id = customerId.trim();
  if (!id) return { cobros: [], error: null };

  const [pres, obras] = await Promise.all([
    supabase.from('budgets').select('id').eq('customer_id', id),
    supabase.from('ci_proyectos').select('id,nombre').eq('customer_id', id),
  ]);

  const budgetIds = (pres.data ?? []).map((b) => String((b as { id?: unknown }).id ?? '')).filter(Boolean);
  const proyectos = (obras.data ?? []) as Array<{ id?: unknown; nombre?: unknown }>;
  const proyectoIds = proyectos.map((p) => String(p.id ?? '')).filter(Boolean);
  const nombreObra = new Map(proyectos.map((p) => [String(p.id ?? ''), String(p.nombre ?? 'Obra')]));

  const cobros: CobroCliente[] = [];
  const errores: string[] = [];

  if (budgetIds.length) {
    const abonos = await supabase
      .from('budget_abonos')
      .select('id,budget_id,monto,moneda,monto_usd,metodo,fecha_abono,created_at')
      .in('budget_id', budgetIds)
      .order('fecha_abono', { ascending: false });
    if (abonos.error) {
      if (!/does not exist|schema cache/i.test(abonos.error.message)) errores.push(abonos.error.message);
    } else {
      for (const row of abonos.data ?? []) {
        const n = normalizarAbonoPresupuesto(row);
        if (n) cobros.push(n);
      }
    }
  }

  if (proyectoIds.length) {
    const abonosObra = await supabase
      .from('ci_proyecto_abonos')
      .select(
        'id,proyecto_id,monto_recibido,moneda,monto_usd,monto_equivalente_usd,banco_origen,fecha_abono,created_at',
      )
      .in('proyecto_id', proyectoIds)
      .order('fecha_abono', { ascending: false });
    if (abonosObra.error) {
      const msg = abonosObra.error.message;
      if (/monto_equivalente_usd/i.test(msg)) {
        const retry = await supabase
          .from('ci_proyecto_abonos')
          .select('id,proyecto_id,monto_recibido,moneda,monto_usd,banco_origen,fecha_abono,created_at')
          .in('proyecto_id', proyectoIds)
          .order('fecha_abono', { ascending: false });
        if (retry.error) {
          if (!/does not exist|schema cache/i.test(retry.error.message)) errores.push(retry.error.message);
        } else {
          for (const row of retry.data ?? []) {
            const r = row as { proyecto_id?: unknown };
            const n = normalizarAbonoObra(row, nombreObra.get(String(r.proyecto_id ?? '')));
            if (n) cobros.push(n);
          }
        }
      } else if (!/does not exist|schema cache/i.test(msg)) {
        errores.push(msg);
      }
    } else {
      for (const row of abonosObra.data ?? []) {
        const r = row as { proyecto_id?: unknown };
        const n = normalizarAbonoObra(row, nombreObra.get(String(r.proyecto_id ?? '')));
        if (n) cobros.push(n);
      }
    }
  }

  return {
    cobros: unirCobrosCliente(cobros),
    error: errores[0] ?? null,
  };
}
