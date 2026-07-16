import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarJerarquiaContratos } from '@/lib/contabilidad/cco/contratosJerarquia';
import type { CcoContratoConSaldo } from '@/lib/contabilidad/cco/types';

export type CcoDeudaFila = CcoContratoConSaldo & {
  proveedor: string;
};

export type CcoDeudasResumen = {
  deudas: CcoDeudaFila[];
  totalDeuda: number;
  contratosConDeuda: number;
  huerfanosMonto: number;
  huerfanosCount: number;
};

/** Deudas = contratos con saldo > 0 + monto de pagos huérfanos. */
export async function cargarDeudasCco(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CcoDeudasResumen> {
  const jer = await cargarJerarquiaContratos(supabase, proyectoId);
  const deudas: CcoDeudaFila[] = [];
  for (const p of jer.porProveedor) {
    for (const c of p.contratos) {
      if (c.saldo_usd > 0.009) {
        deudas.push({ ...c, proveedor: p.proveedor });
      }
    }
  }
  deudas.sort((a, b) => b.saldo_usd - a.saldo_usd);
  const huerfanosMonto = jer.huerfanos.reduce((a, h) => a + h.monto_usd, 0);

  return {
    deudas,
    totalDeuda: deudas.reduce((a, d) => a + d.saldo_usd, 0),
    contratosConDeuda: deudas.length,
    huerfanosMonto,
    huerfanosCount: jer.huerfanos.length,
  };
}
