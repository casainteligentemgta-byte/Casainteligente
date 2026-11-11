import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Conciliación factura ↔ recepción ↔ stock.
 *
 * Tres fuentes, una fila por (factura, ubicación, material):
 * - Factura: cuarentenas (quality_inspections), con lo facturado y su estado.
 * - Ledger: inv_movimientos con documento_id (tránsito y disponible atribuidos a la factura).
 * - Stock: inventario_stock, comparado con la suma del ledger de cada ubicación y material.
 *
 * Limitación: la liberación de tránsito a disponible (recepción física) se registra como
 * 'ajuste' SIN documento_id. Por eso el disponible no se puede atribuir a la factura, y el
 * tránsito se juzga por material y ubicación en todo el ledger (neto), no por factura.
 *
 * Las alertas marcan lo que no cuadra; el informe no corrige nada.
 */

export type MovimientoConciliacion = {
  documento_id: string | null;
  ubicacion_id: string;
  material_id: string;
  delta_disponible: number;
  delta_transito_entrante: number;
};

export type InspeccionConciliacion = {
  invoice_id: string;
  material_id: string;
  quantity: number;
  status: string;
  ubicacion_id: string | null;
};

export type StockConciliacion = {
  ubicacion_id: string;
  material_id: string;
  cantidad_disponible: number;
  cantidad_en_transito_entrante: number;
};

export type FacturaConciliacion = {
  id: string;
  ubicacion_id: string | null;
  numero: string | null;
  proveedor: string | null;
};

export type EstadoConciliacion = 'recibido' | 'en_cuarentena' | 'en_transito' | 'factura_borrada';

export type FilaConciliacion = {
  documentoId: string;
  facturaExiste: boolean;
  numeroFactura: string | null;
  proveedor: string | null;
  ubicacionId: string;
  materialId: string;
  facturado: number;
  aprobado: number;
  rechazado: number;
  pendiente: number;
  transitoLedger: number;
  disponibleLedger: number;
  estado: EstadoConciliacion;
  alertas: string[];
};

export type CuadreStock = {
  ubicacionId: string;
  materialId: string;
  stockDisponible: number;
  ledgerDisponible: number;
  stockTransito: number;
  ledgerTransito: number;
};

export type ResultadoConciliacion = {
  filas: FilaConciliacion[];
  cuadreStock: CuadreStock[];
  resumen: {
    documentos: number;
    filas: number;
    filasConAlerta: number;
    facturasBorradas: number;
    transitoHuerfano: number;
    stockDescuadrado: number;
  };
};

const TOL = 0.0001;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clave(...partes: string[]): string {
  return partes.join('|');
}

type Acum = {
  facturado: number;
  aprobado: number;
  rechazado: number;
  pendiente: number;
  transito: number;
  disponible: number;
  ubicacionId: string | null;
};

function acumuladorVacio(): Acum {
  return {
    facturado: 0,
    aprobado: 0,
    rechazado: 0,
    pendiente: 0,
    transito: 0,
    disponible: 0,
    ubicacionId: null,
  };
}

export function conciliarCompras(input: {
  facturas: FacturaConciliacion[];
  inspecciones: InspeccionConciliacion[];
  movimientos: MovimientoConciliacion[];
  stock: StockConciliacion[];
}): ResultadoConciliacion {
  const facturaPorId = new Map(input.facturas.map((f) => [f.id, f]));

  // 1) Ledger atribuido a documentos, por (documento, ubicación, material).
  const porLedger = new Map<string, Acum>();
  // 2) Cuarentenas por (factura, material), con la ubicación de la factura.
  const porFactura = new Map<string, Acum>();

  for (const m of input.movimientos) {
    if (!m.documento_id) continue;
    const k = clave(m.documento_id, m.ubicacion_id, m.material_id);
    const a = porLedger.get(k) ?? acumuladorVacio();
    a.transito += num(m.delta_transito_entrante);
    a.disponible += num(m.delta_disponible);
    a.ubicacionId = m.ubicacion_id;
    porLedger.set(k, a);
  }

  for (const i of input.inspecciones) {
    const k = clave(i.invoice_id, i.material_id);
    const a = porFactura.get(k) ?? acumuladorVacio();
    const cant = num(i.quantity);
    a.facturado += cant;
    const st = String(i.status ?? '').toUpperCase();
    if (st === 'APROBADO') a.aprobado += cant;
    else if (st === 'RECHAZADO') a.rechazado += cant;
    else if (st === 'PENDIENTE') a.pendiente += cant;
    a.ubicacionId = i.ubicacion_id ?? a.ubicacionId;
    porFactura.set(k, a);
  }

  // Neto del ledger completo (con y sin documento) y cuarentena pendiente, por (ubicación, material).
  const transitoNeto = new Map<string, number>();
  for (const m of input.movimientos) {
    const k = clave(m.ubicacion_id, m.material_id);
    transitoNeto.set(k, (transitoNeto.get(k) ?? 0) + num(m.delta_transito_entrante));
  }
  const pendienteMaterial = new Map<string, number>();
  for (const i of input.inspecciones) {
    if (String(i.status ?? '').toUpperCase() !== 'PENDIENTE') continue;
    const k = clave(i.ubicacion_id ?? '', i.material_id);
    pendienteMaterial.set(k, (pendienteMaterial.get(k) ?? 0) + num(i.quantity));
  }

  // 3) Unión de claves: ledger y cuarentenas, sin repetir.
  const filas: FilaConciliacion[] = [];
  const visto = new Set<string>();

  const procesar = (documentoId: string, materialId: string, ubicacionId: string | null, l: Acum, f: Acum) => {
    const ub = ubicacionId ?? l.ubicacionId ?? f.ubicacionId ?? '';
    const k = clave(documentoId, ub, materialId);
    if (visto.has(k)) return;
    visto.add(k);

    const factura = facturaPorId.get(documentoId);
    const facturaExiste = Boolean(factura);
    const movido = Math.abs(l.transito) > TOL || Math.abs(l.disponible) > TOL;
    const netoTransito = transitoNeto.get(clave(ub, materialId)) ?? 0;
    const pendienteEnMaterial = pendienteMaterial.get(clave(ub, materialId)) ?? 0;
    const alertas: string[] = [];

    if (!facturaExiste && movido) {
      alertas.push('Factura borrada: el ledger sigue mostrando movimientos de este documento.');
    }
    // Se mira el neto del material: si el tránsito ya se liberó (sin documento), no es huérfano.
    if (facturaExiste && l.transito > TOL && netoTransito > TOL && pendienteEnMaterial <= TOL) {
      alertas.push('Tránsito sin cuarentena pendiente: nadie espera esta mercancía.');
    }
    let estado: EstadoConciliacion;
    if (!facturaExiste) estado = 'factura_borrada';
    else if (f.pendiente > TOL) estado = 'en_cuarentena';
    else if (netoTransito > TOL && l.transito > TOL) estado = 'en_transito';
    else estado = 'recibido';

    filas.push({
      documentoId,
      facturaExiste,
      numeroFactura: factura?.numero ?? null,
      proveedor: factura?.proveedor ?? null,
      ubicacionId: ub,
      materialId,
      facturado: f.facturado,
      aprobado: f.aprobado,
      rechazado: f.rechazado,
      pendiente: f.pendiente,
      transitoLedger: l.transito,
      disponibleLedger: l.disponible,
      estado,
      alertas,
    });
  };

  for (const [k, l] of porLedger) {
    const [docId, ub, mat] = k.split('|');
    procesar(docId, mat, ub, l, porFactura.get(clave(docId, mat)) ?? acumuladorVacio());
  }
  for (const [k, f] of porFactura) {
    const [docId, mat] = k.split('|');
    const ub = f.ubicacionId ?? facturaPorId.get(docId)?.ubicacion_id ?? '';
    const l = porLedger.get(clave(docId, ub, mat)) ?? acumuladorVacio();
    procesar(docId, mat, ub, l, f);
  }

  // 4) Cuadre ledger ↔ stock: el ledger completo (con y sin documento) debe sumar lo que hay en stock.
  const sumaLedger = new Map<string, { disp: number; tr: number }>();
  for (const m of input.movimientos) {
    const k = clave(m.ubicacion_id, m.material_id);
    const s = sumaLedger.get(k) ?? { disp: 0, tr: 0 };
    s.disp += num(m.delta_disponible);
    s.tr += num(m.delta_transito_entrante);
    sumaLedger.set(k, s);
  }
  const cuadreStock: CuadreStock[] = [];
  const claveStock = new Set<string>();
  for (const s of input.stock) {
    const k = clave(s.ubicacion_id, s.material_id);
    claveStock.add(k);
    const l = sumaLedger.get(k) ?? { disp: 0, tr: 0 };
    const stockDisp = num(s.cantidad_disponible);
    const stockTr = num(s.cantidad_en_transito_entrante);
    if (Math.abs(stockDisp - l.disp) > TOL || Math.abs(stockTr - l.tr) > TOL) {
      cuadreStock.push({
        ubicacionId: s.ubicacion_id,
        materialId: s.material_id,
        stockDisponible: stockDisp,
        ledgerDisponible: l.disp,
        stockTransito: stockTr,
        ledgerTransito: l.tr,
      });
    }
  }
  // Movimientos de ubicación/material sin fila de stock: también descuadran.
  for (const [k, l] of sumaLedger) {
    if (claveStock.has(k)) continue;
    if (Math.abs(l.disp) > TOL || Math.abs(l.tr) > TOL) {
      const [ub, mat] = k.split('|');
      cuadreStock.push({
        ubicacionId: ub,
        materialId: mat,
        stockDisponible: 0,
        ledgerDisponible: l.disp,
        stockTransito: 0,
        ledgerTransito: l.tr,
      });
    }
  }

  // Primero lo que necesita atención.
  filas.sort((a, b) => b.alertas.length - a.alertas.length || (a.facturaExiste ? 1 : 0) - (b.facturaExiste ? 1 : 0));

  const documentos = new Set(filas.map((f) => f.documentoId));
  const borradas = filas.filter((f) => !f.facturaExiste);
  return {
    filas,
    cuadreStock,
    resumen: {
      documentos: documentos.size,
      filas: filas.length,
      filasConAlerta: filas.filter((f) => f.alertas.length > 0).length,
      facturasBorradas: new Set(borradas.map((f) => f.documentoId)).size,
      transitoHuerfano: borradas.reduce((s, f) => s + f.transitoLedger, 0),
      stockDescuadrado: cuadreStock.length,
    },
  };
}

/** Lee las tablas y arma el informe. Solo lectura. */
export async function cargarInformeConciliacionCompras(
  supabase: SupabaseClient,
): Promise<ResultadoConciliacion & { materiales: Record<string, { nombre: string; unidad: string }> }> {
  const [movRes, inspRes, stockRes] = await Promise.all([
    supabase
      .from('inv_movimientos')
      .select('documento_id, ubicacion_id, material_id, delta_disponible, delta_transito_entrante')
      .limit(20000),
    supabase.from('quality_inspections').select('invoice_id, material_id, quantity, status').limit(20000),
    supabase
      .from('inventario_stock')
      .select('ubicacion_id, material_id, cantidad_disponible, cantidad_en_transito_entrante')
      .limit(20000),
  ]);
  if (movRes.error) throw new Error(movRes.error.message);
  if (inspRes.error && inspRes.error.code !== '42P01') throw new Error(inspRes.error.message);
  if (stockRes.error) throw new Error(stockRes.error.message);

  const movimientos = (movRes.data ?? []) as Array<Record<string, unknown>>;
  const movs: MovimientoConciliacion[] = movimientos.map((m) => ({
    documento_id: m.documento_id != null ? String(m.documento_id) : null,
    ubicacion_id: String(m.ubicacion_id),
    material_id: String(m.material_id),
    delta_disponible: num(m.delta_disponible),
    delta_transito_entrante: num(m.delta_transito_entrante),
  }));

  const insp = (inspRes.data ?? []) as Array<Record<string, unknown>>;
  const inspecciones: InspeccionConciliacion[] = insp.map((i) => ({
    invoice_id: String(i.invoice_id),
    material_id: String(i.material_id),
    quantity: num(i.quantity),
    status: String(i.status ?? ''),
    ubicacion_id: null,
  }));

  const stock: StockConciliacion[] = ((stockRes.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
    ubicacion_id: String(s.ubicacion_id),
    material_id: String(s.material_id),
    cantidad_disponible: num(s.cantidad_disponible),
    cantidad_en_transito_entrante: num(s.cantidad_en_transito_entrante),
  }));

  const docIds = Array.from(
    new Set([
      ...movs.map((m) => m.documento_id).filter(Boolean),
      ...inspecciones.map((i) => i.invoice_id),
    ] as string[]),
  );
  const materialIds = Array.from(
    new Set([...movs.map((m) => m.material_id), ...inspecciones.map((i) => i.material_id)]),
  );

  const facturas: FacturaConciliacion[] = [];
  if (docIds.length) {
    const { data, error } = await supabase
      .from('purchase_invoices')
      .select('id, invoice_number, supplier_name, ubicacion_destino_id')
      .in('id', docIds);
    if (error) throw new Error(error.message);
    for (const f of (data ?? []) as Array<Record<string, unknown>>) {
      facturas.push({
        id: String(f.id),
        ubicacion_id: f.ubicacion_destino_id != null ? String(f.ubicacion_destino_id) : null,
        numero: f.invoice_number != null ? String(f.invoice_number) : null,
        proveedor: f.supplier_name != null ? String(f.supplier_name) : null,
      });
    }
  }

  const materiales: Record<string, { nombre: string; unidad: string }> = {};
  if (materialIds.length) {
    const { data, error } = await supabase
      .from('global_inventory')
      .select('id, name, unit')
      .in('id', materialIds);
    if (error) throw new Error(error.message);
    for (const m of (data ?? []) as Array<Record<string, unknown>>) {
      materiales[String(m.id)] = {
        nombre: String(m.name ?? 'Material'),
        unidad: String(m.unit ?? 'UND'),
      };
    }
  }

  // Las cuarentenas heredan la ubicación de su factura.
  const ubPorFactura = new Map(facturas.map((f) => [f.id, f.ubicacion_id]));
  for (const i of inspecciones) i.ubicacion_id = ubPorFactura.get(i.invoice_id) ?? null;

  const resultado = conciliarCompras({ facturas, inspecciones, movimientos: movs, stock });
  return { ...resultado, materiales };
}
