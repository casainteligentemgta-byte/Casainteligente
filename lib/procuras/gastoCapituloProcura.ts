import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cuánto se lleva gastado en el capítulo (o en la obra, si la procura no tiene capítulo):
 * compras ya facturadas de procuras de ese capítulo, más lo aprobado que falta comprar.
 * Es informativo para quien aprueba; todavía no se compara contra un presupuesto.
 */
export type GastoCapituloProcura = {
  ambito: 'capitulo' | 'obra';
  compradoUsd: number;
  compras: number;
  aprobadoSinComprarUsd: number;
  aprobadasSinComprar: number;
};

type Fila = Record<string, unknown>;
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

const ESTADOS_APROBADA = ['aprobada', 'aprobada_directa'];

/** Suma pura (testeable): procuras del ámbito con sus compras ya registradas. */
export function sumarGastoCapitulo(
  procuras: { id: string; estado: string; monto_estimado_usd: number | null; purchase_invoice_id: string | null }[],
  compraUsdPorFactura: Map<string, number>,
  excluirProcuraId?: string | null,
): Omit<GastoCapituloProcura, 'ambito'> {
  let compradoUsd = 0;
  let compras = 0;
  let aprobadoSinComprarUsd = 0;
  let aprobadasSinComprar = 0;
  const facturasContadas = new Set<string>();
  for (const p of procuras) {
    if (excluirProcuraId && p.id === excluirProcuraId) continue;
    const pi = p.purchase_invoice_id?.trim() || '';
    if (pi && compraUsdPorFactura.has(pi)) {
      // Varias procuras pueden ir en una misma factura: se cuenta una vez.
      if (!facturasContadas.has(pi)) {
        facturasContadas.add(pi);
        compradoUsd += compraUsdPorFactura.get(pi) ?? 0;
        compras += 1;
      }
      continue;
    }
    if (ESTADOS_APROBADA.includes(p.estado)) {
      aprobadasSinComprar += 1;
      aprobadoSinComprarUsd += Number(p.monto_estimado_usd) || 0;
    }
  }
  return {
    compradoUsd: Math.round(compradoUsd * 100) / 100,
    compras,
    aprobadoSinComprarUsd: Math.round(aprobadoSinComprarUsd * 100) / 100,
    aprobadasSinComprar,
  };
}

/** Null si no hay obra o no se pudo leer: el mensaje sale igual, sin el bloque. */
export async function cargarGastoCapituloProcura(
  supabase: SupabaseClient,
  params: { procuraId: string; proyectoId: string | null | undefined; capituloId: string | null | undefined },
): Promise<GastoCapituloProcura | null> {
  const pid = params.proyectoId?.trim();
  if (!pid) return null;
  const cap = params.capituloId?.trim() || null;
  try {
    const columnas: string = 'id,estado,monto_estimado_usd,purchase_invoice_id';
    let q = supabase.from('ci_procuras').select(columnas).eq('proyecto_id', pid).neq('estado', 'cancelada');
    if (cap) q = q.eq('capitulo_maestro_id', cap);
    const { data, error } = await q.limit(2000);
    if (error) throw new Error(error.message);
    const procuras = ((data ?? []) as unknown as Fila[]).map((p) => ({
      id: txt(p.id),
      estado: txt(p.estado),
      monto_estimado_usd: p.monto_estimado_usd == null ? null : Number(p.monto_estimado_usd),
      purchase_invoice_id: txt(p.purchase_invoice_id) || null,
    }));

    const facturas = Array.from(new Set(procuras.map((p) => p.purchase_invoice_id).filter((x): x is string => !!x)));
    const compraUsd = new Map<string, number>();
    for (let i = 0; i < facturas.length; i += 200) {
      const colCompras: string = 'purchase_invoice_id,monto_usd,total_amount_usd,cco_estado';
      const { data: compras } = await supabase
        .from('contabilidad_compras')
        .select(colCompras)
        .in('purchase_invoice_id', facturas.slice(i, i + 200));
      for (const c of (compras ?? []) as unknown as Fila[]) {
        if (txt(c.cco_estado).toUpperCase() === 'ANULADO') continue;
        const pi = txt(c.purchase_invoice_id);
        compraUsd.set(pi, (compraUsd.get(pi) ?? 0) + (Number(c.monto_usd ?? c.total_amount_usd) || 0));
      }
    }

    return { ambito: cap ? 'capitulo' : 'obra', ...sumarGastoCapitulo(procuras, compraUsd, params.procuraId) };
  } catch (e) {
    console.warn('[gastoCapituloProcura] no se pudo calcular:', e);
    return null;
  }
}

function usd(n: number): string {
  return `USD ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Bloque HTML para el ticket de aprobación. Cadena vacía si no hay datos. */
export function bloqueGastoCapitulo(
  gasto: GastoCapituloProcura | null | undefined,
  montoEstimadoUsd: number | null | undefined,
): string {
  if (!gasto) return '';
  const estimado = Number(montoEstimadoUsd) > 0 ? Number(montoEstimadoUsd) : 0;
  const titulo = gasto.ambito === 'capitulo' ? 'Gasto del capítulo en esta obra' : 'Gasto de compras en esta obra';
  const lineas = [
    `\n\n📒 <b>${titulo}</b>`,
    `Comprado: ${usd(gasto.compradoUsd)} (${gasto.compras} factura${gasto.compras === 1 ? '' : 's'})`,
  ];
  if (gasto.aprobadasSinComprar > 0) {
    lineas.push(`Aprobado sin comprar: ${usd(gasto.aprobadoSinComprarUsd)} (${gasto.aprobadasSinComprar})`);
  }
  if (estimado > 0) {
    lineas.push(`Con esta procura: <b>${usd(gasto.compradoUsd + gasto.aprobadoSinComprarUsd + estimado)}</b>`);
  }
  return lineas.join('\n');
}
