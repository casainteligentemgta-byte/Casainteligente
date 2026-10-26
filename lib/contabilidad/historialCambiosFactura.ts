import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Historial de cambios de factura (ci_facturas_historial_cambios). Se registra cada campo
 * que cambia al corregir una factura, desde la web o desde Telegram.
 */

export type CambioFactura = { campo: string; anterior: string | null; nuevo: string | null };

/** Campos de la factura que se registran en el historial. */
export const CAMPOS_HISTORIAL_FACTURA = [
  'invoice_number',
  'supplier_rif',
  'supplier_name',
  'date',
  'total_amount',
] as const;

function normalizarValor(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  // 1250 y "1250.00" son el mismo monto.
  return s !== '' && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(s) ? String(n) : s;
}

/** Diferencias entre dos versiones de la factura, solo en los campos indicados. */
export function cambiosEntreFacturas(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  campos: readonly string[] = CAMPOS_HISTORIAL_FACTURA,
): CambioFactura[] {
  const cambios: CambioFactura[] = [];
  for (const campo of campos) {
    if (next[campo] === undefined) continue;
    const anterior = normalizarValor(prev[campo]);
    const nuevo = normalizarValor(next[campo]);
    if (anterior !== nuevo) cambios.push({ campo, anterior, nuevo });
  }
  return cambios;
}

export async function registrarCambiosFactura(
  supabase: SupabaseClient,
  params: {
    tabla: 'ci_facturas_canal_pendientes' | 'purchase_invoices';
    registroId: string;
    cambios: CambioFactura[];
    origen: 'telegram' | 'web';
    actor?: string | null;
  },
): Promise<void> {
  if (!params.cambios.length) return;
  const { error } = await supabase.from('ci_facturas_historial_cambios').insert(
    params.cambios.map((c) => ({
      tabla: params.tabla,
      registro_id: params.registroId,
      campo: c.campo,
      valor_anterior: c.anterior,
      valor_nuevo: c.nuevo,
      origen: params.origen,
      actor: params.actor ?? null,
    })),
  );
  // El cambio ya se aplicó: si el historial falla, no se revierte la corrección.
  if (error) console.warn('[historialCambiosFactura]', error.message);
}
