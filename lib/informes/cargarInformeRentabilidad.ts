import type { SupabaseClient } from '@supabase/supabase-js';
import { calcularTotalesComprasObra } from '@/lib/contabilidad/resumenComprasObra';
import { ESTADOS_VENTA, montoPagadoDe } from '@/lib/presupuesto/listaPresupuestos';

export type FilaRentabilidadObra = {
  proyectoId: string;
  proyectoNombre: string;
  ventasAceptadasUsd: number;
  cobradoUsd: number;
  porCobrarUsd: number;
  comprasUsd: number;
  facturasCompra: number;
  margenBrutoUsd: number;
  margenBrutoPct: number | null;
  /** Ventas se asignan por cliente de la obra (`customer_id`); puede ser null. */
  customerId: string | null;
};

export type ResumenRentabilidad = {
  obras: number;
  ventasAceptadasUsd: number;
  cobradoUsd: number;
  comprasUsd: number;
  margenBrutoUsd: number;
};

type BudgetRow = {
  customer_id?: string | null;
  subtotal?: number | null;
  status?: string | null;
  monto_pagado?: number | null;
  saldo?: number | null;
};

/**
 * Rentabilidad simple por obra: compras de la obra + presupuestos del cliente de la obra.
 * No incluye nómina ni CCO (próximo pack).
 */
export async function cargarInformeRentabilidad(
  supabase: SupabaseClient,
  opts?: { proyectoId?: string | null; limiteObras?: number },
): Promise<{ filas: FilaRentabilidadObra[]; resumen: ResumenRentabilidad }> {
  const limite = Math.min(Math.max(opts?.limiteObras ?? 40, 1), 80);
  const solo = opts?.proyectoId?.trim();

  let proyectosQ = supabase
    .from('ci_proyectos')
    .select('id,nombre,customer_id')
    .order('nombre', { ascending: true })
    .limit(limite);
  if (solo) proyectosQ = proyectosQ.eq('id', solo);

  const { data: proyectos, error: pErr } = await proyectosQ;
  if (pErr) throw new Error(pErr.message);

  const lista = (proyectos ?? []) as Array<{
    id: string;
    nombre: string | null;
    customer_id: string | null;
  }>;

  const customerIds = [
    ...new Set(lista.map((p) => (p.customer_id ? String(p.customer_id) : '')).filter(Boolean)),
  ];

  const budgetsPorCliente = new Map<string, BudgetRow[]>();
  if (customerIds.length) {
    const { data: budgets, error: bErr } = await supabase
      .from('budgets')
      .select('customer_id,subtotal,status,monto_pagado,saldo')
      .in('customer_id', customerIds);
    if (bErr && !/monto_pagado|saldo|column/i.test(bErr.message)) {
      throw new Error(bErr.message);
    }
    // Si faltan columnas de cobro, reintentar sin ellas.
    let rows = (budgets ?? []) as BudgetRow[];
    if (bErr && /monto_pagado|saldo/i.test(bErr.message)) {
      const retry = await supabase
        .from('budgets')
        .select('customer_id,subtotal,status')
        .in('customer_id', customerIds);
      if (retry.error) throw new Error(retry.error.message);
      rows = (retry.data ?? []) as BudgetRow[];
    }
    for (const b of rows) {
      const cid = b.customer_id ? String(b.customer_id) : '';
      if (!cid) continue;
      const arr = budgetsPorCliente.get(cid) ?? [];
      arr.push(b);
      budgetsPorCliente.set(cid, arr);
    }
  }

  const filas: FilaRentabilidadObra[] = [];

  for (const p of lista) {
    const proyectoId = String(p.id);
    const proyectoNombre = String(p.nombre ?? 'Obra').trim() || 'Obra';
    const customerId = p.customer_id ? String(p.customer_id) : null;

    const compras = await calcularTotalesComprasObra(supabase, proyectoId).catch(() => ({
      facturasContabilidad: 0,
      facturasCanalExtra: 0,
      totalVes: 0,
      totalUsd: 0,
    }));

    let ventasAceptadasUsd = 0;
    let cobradoUsd = 0;
    if (customerId) {
      for (const b of budgetsPorCliente.get(customerId) ?? []) {
        const st = String(b.status ?? '');
        if (!(ESTADOS_VENTA as readonly string[]).includes(st)) continue;
        const sub = Number(b.subtotal) || 0;
        ventasAceptadasUsd += sub;
        cobradoUsd += montoPagadoDe({
          status: st,
          subtotal: sub,
          monto_pagado: b.monto_pagado,
          saldo: b.saldo,
        });
      }
    }

    const comprasUsd = Number(compras.totalUsd) || 0;
    const margenBrutoUsd = Math.round((ventasAceptadasUsd - comprasUsd) * 100) / 100;
    const margenBrutoPct =
      ventasAceptadasUsd > 0
        ? Math.round((margenBrutoUsd / ventasAceptadasUsd) * 1000) / 10
        : null;

    filas.push({
      proyectoId,
      proyectoNombre,
      customerId,
      ventasAceptadasUsd: Math.round(ventasAceptadasUsd * 100) / 100,
      cobradoUsd: Math.round(cobradoUsd * 100) / 100,
      porCobrarUsd: Math.max(0, Math.round((ventasAceptadasUsd - cobradoUsd) * 100) / 100),
      comprasUsd: Math.round(comprasUsd * 100) / 100,
      facturasCompra: compras.facturasContabilidad + compras.facturasCanalExtra,
      margenBrutoUsd,
      margenBrutoPct,
    });
  }

  filas.sort((a, b) => b.comprasUsd - a.comprasUsd);

  // Ventas van por cliente: si varias obras comparten customer_id, no sumar dos veces.
  const clientesVistos = new Set<string>();
  let ventasAceptadasUsd = 0;
  let cobradoUsd = 0;
  for (const f of filas) {
    const key = f.customerId || `obra:${f.proyectoId}`;
    if (clientesVistos.has(key)) continue;
    clientesVistos.add(key);
    ventasAceptadasUsd += f.ventasAceptadasUsd;
    cobradoUsd += f.cobradoUsd;
  }
  const comprasUsd = Math.round(filas.reduce((s, f) => s + f.comprasUsd, 0) * 100) / 100;

  const resumen: ResumenRentabilidad = {
    obras: filas.length,
    ventasAceptadasUsd: Math.round(ventasAceptadasUsd * 100) / 100,
    cobradoUsd: Math.round(cobradoUsd * 100) / 100,
    comprasUsd,
    margenBrutoUsd: Math.round((ventasAceptadasUsd - comprasUsd) * 100) / 100,
  };

  return { filas, resumen };
}
