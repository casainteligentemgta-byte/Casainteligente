import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';

/**
 * Ficha de proveedores (Torre de Control): cuánto se le compra y qué tan bien cumple.
 * Agrupa por RIF (o por nombre si no hay RIF) en la ventana de días indicada.
 */

export type FichaProveedor = {
  clave: string;
  nombre: string;
  rif: string | null;
  compras: number;
  montoUsd: number;
  diferencias: number;
  montoDiferenciasUsd: number;
  lineasRechazadas: number;
  lineasRecibidas: number;
  /** Días promedio desde la factura hasta que se aprobó la recepción. */
  diasRecepcion: number | null;
  /** 0–100: baja con diferencias, rechazos y demoras. */
  puntaje: number;
};

type Fila = Record<string, unknown>;
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

export function claveProveedor(rif: string | null | undefined, nombre: string | null | undefined): string {
  const r = txt(rif).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (r.length >= 6) return `rif:${r}`;
  return `nom:${normalizarTextoMaterial(txt(nombre))}`;
}

/** Puntaje simple y explicable: 100 menos penalizaciones (mínimo 0). */
export function puntajeProveedor(f: Pick<FichaProveedor, 'compras' | 'diferencias' | 'lineasRechazadas' | 'lineasRecibidas' | 'diasRecepcion'>): number {
  if (!f.compras) return 100;
  const tasaDif = f.diferencias / f.compras;
  const totalLineas = f.lineasRechazadas + f.lineasRecibidas;
  const tasaRech = totalLineas ? f.lineasRechazadas / totalLineas : 0;
  const demora = f.diasRecepcion != null ? Math.max(0, f.diasRecepcion - 3) : 0; // 3 días es normal
  const p = 100 - tasaDif * 40 - tasaRech * 40 - Math.min(20, demora * 2);
  return Math.max(0, Math.round(p));
}

export async function calcularFichaProveedores(
  supabase: SupabaseClient,
  opts?: { dias?: number },
): Promise<FichaProveedor[]> {
  const dias = opts?.dias ?? 180;
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  const { data: compras } = await supabase
    .from('contabilidad_compras')
    .select('id,purchase_invoice_id,supplier_rif,supplier_name,monto_usd,total_amount_usd,cco_estado,created_at')
    .gte('created_at', desde)
    .limit(2000);
  const filas = ((compras ?? []) as Fila[]).filter((c) => txt(c.cco_estado).toUpperCase() !== 'ANULADO');

  const fichas = new Map<string, FichaProveedor & { _dias: number[] }>();
  const porFactura = new Map<string, string>();
  for (const c of filas) {
    const nombre = txt(c.supplier_name) || 'Proveedor sin nombre';
    const clave = claveProveedor(txt(c.supplier_rif), nombre);
    const f =
      fichas.get(clave) ??
      ({
        clave,
        nombre,
        rif: txt(c.supplier_rif) || null,
        compras: 0,
        montoUsd: 0,
        diferencias: 0,
        montoDiferenciasUsd: 0,
        lineasRechazadas: 0,
        lineasRecibidas: 0,
        diasRecepcion: null,
        puntaje: 100,
        _dias: [],
      } as FichaProveedor & { _dias: number[] });
    f.compras += 1;
    f.montoUsd += Number(c.monto_usd ?? c.total_amount_usd) || 0;
    fichas.set(clave, f);
    const pi = txt(c.purchase_invoice_id);
    if (pi) porFactura.set(pi, clave);
  }

  const facturas = Array.from(porFactura.keys());
  if (facturas.length) {
    const lote = (arr: string[], n = 200) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
    for (const ids of lote(facturas)) {
      const [{ data: difs }, { data: insps }, { data: invs }] = await Promise.all([
        supabase.from('ci_control_compras').select('purchase_invoice_id,monto_diferencia,moneda').in('purchase_invoice_id', ids),
        supabase.from('quality_inspections').select('invoice_id,status,inspected_at').in('invoice_id', ids),
        supabase.from('purchase_invoices').select('id,created_at').in('id', ids),
      ]);
      const creada = new Map(((invs ?? []) as Fila[]).map((i) => [txt(i.id), txt(i.created_at)]));
      for (const d of (difs ?? []) as Fila[]) {
        const f = fichas.get(porFactura.get(txt(d.purchase_invoice_id)) ?? '');
        if (!f) continue;
        f.diferencias += 1;
        if (txt(d.moneda).toUpperCase() === 'USD') f.montoDiferenciasUsd += Number(d.monto_diferencia) || 0;
      }
      const ultimaAprobacion = new Map<string, string>();
      for (const q of (insps ?? []) as Fila[]) {
        const pi = txt(q.invoice_id);
        const f = fichas.get(porFactura.get(pi) ?? '');
        if (!f) continue;
        const st = txt(q.status).toUpperCase();
        if (st === 'RECHAZADO') f.lineasRechazadas += 1;
        if (st === 'APROBADO') {
          f.lineasRecibidas += 1;
          const at = txt(q.inspected_at);
          if (at && at > (ultimaAprobacion.get(pi) ?? '')) ultimaAprobacion.set(pi, at);
        }
      }
      for (const [pi, at] of Array.from(ultimaAprobacion.entries())) {
        const f = fichas.get(porFactura.get(pi) ?? '');
        const ini = Date.parse(creada.get(pi) ?? '');
        const fin = Date.parse(at);
        if (f && Number.isFinite(ini) && Number.isFinite(fin) && fin >= ini) f._dias.push((fin - ini) / 86_400_000);
      }
    }
  }

  return Array.from(fichas.values())
    .map(({ _dias, ...f }) => {
      const diasRecepcion = _dias.length ? Math.round((_dias.reduce((a, b) => a + b, 0) / _dias.length) * 10) / 10 : null;
      const out = { ...f, montoUsd: Math.round(f.montoUsd * 100) / 100, diasRecepcion };
      return { ...out, puntaje: puntajeProveedor(out) };
    })
    .sort((a, b) => a.puntaje - b.puntaje || b.montoUsd - a.montoUsd);
}
