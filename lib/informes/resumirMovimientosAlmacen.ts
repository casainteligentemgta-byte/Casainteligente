import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Movimientos de almacén de un periodo: entradas, salidas, existencia y tránsito por
 * (almacén, material). Solo lectura.
 *
 * Existencia inicial = existencia actual − neto del periodo. Por eso el periodo termina
 * hoy: los movimientos posteriores a una fecha de corte no se pueden restar.
 *
 * Las entradas incluyen las liberaciones de tránsito a disponible y los traslados
 * entrantes; las salidas incluyen bajas y traslados salientes. Las liberaciones sin
 * documento_id no se atribuyen a una factura aquí.
 */

export type MovimientoAlmacen = {
  ubicacion_id: string;
  material_id: string;
  delta_disponible: number | string | null;
  delta_transito_entrante: number | string | null;
  created_at: string;
};

export type StockAlmacen = {
  ubicacion_id: string;
  material_id: string;
  cantidad_disponible: number | string | null;
  cantidad_en_transito_entrante: number | string | null;
};

export type FilaMovimientoAlmacen = {
  ubicacionId: string;
  ubicacion: string;
  materialId: string;
  material: string;
  unidad: string;
  existenciaInicial: number;
  entradas: number;
  salidas: number;
  existenciaActual: number;
  enTransito: number;
};

export type NombresAlmacen = {
  ubicaciones: Record<string, string>;
  materiales: Record<string, { nombre: string; unidad: string }>;
};

const TOL = 0.0001;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function redondear(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function resumirMovimientosAlmacen(input: {
  movimientos: MovimientoAlmacen[];
  stock: StockAlmacen[];
  desdeIso: string;
  nombres?: NombresAlmacen;
}): FilaMovimientoAlmacen[] {
  const desde = Date.parse(input.desdeIso);
  const nombres: NombresAlmacen = input.nombres ?? { ubicaciones: {}, materiales: {} };

  type Acum = { entradas: number; salidas: number; neto: number; disp: number; tr: number };
  const acum = new Map<string, Acum>();
  const get = (k: string): Acum => {
    const a = acum.get(k) ?? { entradas: 0, salidas: 0, neto: 0, disp: 0, tr: 0 };
    acum.set(k, a);
    return a;
  };

  for (const m of input.movimientos) {
    if (Date.parse(m.created_at) < desde) continue;
    const d = num(m.delta_disponible);
    const a = get(`${m.ubicacion_id}|${m.material_id}`);
    if (d > TOL) a.entradas += d;
    else if (d < -TOL) a.salidas += -d;
    a.neto += d;
  }

  for (const s of input.stock) {
    const a = get(`${s.ubicacion_id}|${s.material_id}`);
    a.disp += num(s.cantidad_disponible);
    a.tr += num(s.cantidad_en_transito_entrante);
  }

  const filas: FilaMovimientoAlmacen[] = [];
  for (const [k, a] of acum) {
    const [ubicacionId, materialId] = k.split('|');
    const movio = Math.abs(a.entradas) > TOL || Math.abs(a.salidas) > TOL;
    if (!movio && Math.abs(a.disp) < TOL && Math.abs(a.tr) < TOL) continue;
    const mat = nombres.materiales[materialId];
    filas.push({
      ubicacionId,
      ubicacion: nombres.ubicaciones[ubicacionId] ?? 'Almacén',
      materialId,
      material: mat?.nombre ?? 'Material',
      unidad: mat?.unidad ?? 'UND',
      existenciaInicial: redondear(a.disp - a.neto),
      entradas: redondear(a.entradas),
      salidas: redondear(a.salidas),
      existenciaActual: redondear(a.disp),
      enTransito: redondear(a.tr),
    });
  }

  filas.sort((x, y) => x.ubicacion.localeCompare(y.ubicacion) || x.material.localeCompare(y.material));
  return filas;
}

/** Lee el ledger del periodo y el stock actual. Solo lectura. */
export async function cargarInformeMovimientosAlmacen(
  supabase: SupabaseClient,
  opts: { dias: number },
): Promise<{
  filas: FilaMovimientoAlmacen[];
  desde: string;
  dias: number;
  resumen: { lineas: number; almacenes: number; lineasEnTransito: number };
}> {
  const dias = Math.min(Math.max(Math.round(opts.dias) || 7, 1), 90);
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  const [movRes, stockRes] = await Promise.all([
    supabase
      .from('inv_movimientos')
      .select('ubicacion_id, material_id, delta_disponible, delta_transito_entrante, created_at')
      .gte('created_at', desde)
      .limit(20000),
    supabase
      .from('inventario_stock')
      .select('ubicacion_id, material_id, cantidad_disponible, cantidad_en_transito_entrante')
      .limit(20000),
  ]);
  if (movRes.error) throw new Error(movRes.error.message);
  if (stockRes.error) throw new Error(stockRes.error.message);

  const movimientos = (movRes.data ?? []) as MovimientoAlmacen[];
  const stock = (stockRes.data ?? []) as StockAlmacen[];

  const ubIds = Array.from(new Set([...movimientos.map((m) => m.ubicacion_id), ...stock.map((s) => s.ubicacion_id)]));
  const matIds = Array.from(new Set([...movimientos.map((m) => m.material_id), ...stock.map((s) => s.material_id)]));

  const nombres: NombresAlmacen = { ubicaciones: {}, materiales: {} };
  if (ubIds.length) {
    const { data, error } = await supabase.from('inv_ubicaciones').select('id, nombre').in('id', ubIds);
    if (error) throw new Error(error.message);
    for (const u of (data ?? []) as Array<{ id: string; nombre: string | null }>) {
      nombres.ubicaciones[String(u.id)] = String(u.nombre ?? 'Almacén');
    }
  }
  if (matIds.length) {
    const { data, error } = await supabase.from('global_inventory').select('id, name, unit').in('id', matIds);
    if (error) throw new Error(error.message);
    for (const m of (data ?? []) as Array<{ id: string; name: string | null; unit: string | null }>) {
      nombres.materiales[String(m.id)] = { nombre: String(m.name ?? 'Material'), unidad: String(m.unit ?? 'UND') };
    }
  }

  const filas = resumirMovimientosAlmacen({ movimientos, stock, desdeIso: desde, nombres });
  return {
    filas,
    desde,
    dias,
    resumen: {
      lineas: filas.filter((f) => f.entradas > TOL || f.salidas > TOL).length,
      almacenes: new Set(filas.map((f) => f.ubicacionId)).size,
      lineasEnTransito: filas.filter((f) => f.enTransito > TOL).length,
    },
  };
}
