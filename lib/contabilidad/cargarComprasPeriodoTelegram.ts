import type { SupabaseClient } from '@supabase/supabase-js';
import {
  compraEnRangoFechas,
  rangoFechasPeriodo,
  todayIsoVenezuela,
  type PeriodoCompras,
} from '@/lib/contabilidad/comprasFiltros';
import {
  lineasDesdeExtractedCanal,
  mapCanalPendienteACompraLista,
  type CanalPendienteParaLista,
  type CompraLineaUi,
} from '@/lib/contabilidad/mapCanalPendienteCompra';

export type PeriodoComprasTelegram = Extract<PeriodoCompras, 'dia' | 'semana' | 'mes'>;

export type LineaMaterialCompraTelegram = {
  fecha: string;
  factura: string;
  proveedor: string;
  origen: string;
  articulo: string;
  codigo: string;
  cantidad: number;
  estado?: string;
};

type CompraRowDb = {
  id: string;
  fecha: string | null;
  created_at: string | null;
  invoice_number: string | null;
  supplier_name: string | null;
  origen: string | null;
  estado: string | null;
  purchase_invoice_id: string | null;
  contabilidad_compra_lineas?:
    | Array<{
        descripcion: string | null;
        item_code: string | null;
        cantidad: number | null;
      }>
    | { count: number }[]
    | null;
};

const MAX_COMPRAS = 500;
const ESTADOS_CANAL_LISTA = ['extraido', 'pendiente', 'procesando', 'error', 'confirmado'] as const;

function etiquetaOrigen(origen: string | null | undefined): string {
  const o = String(origen ?? '').trim().toUpperCase();
  if (o === 'TELEGRAM') return 'Telegram';
  if (o === 'RECEPCION_MERCANCIA') return 'Recepción';
  if (o === 'MANUAL' || o === 'APP') return 'App';
  return o ? o.charAt(0) + o.slice(1).toLowerCase() : 'App';
}

function lineasDesdeContabilidad(c: CompraRowDb): LineaMaterialCompraTelegram[] {
  const nested = c.contabilidad_compra_lineas;
  if (!Array.isArray(nested) || !nested.length) return [];
  const first = nested[0];
  if (!first || !('descripcion' in first)) return [];

  const fecha = String(c.fecha ?? c.created_at ?? '').slice(0, 10);
  const factura = String(c.invoice_number ?? 'S/N').trim();
  const proveedor = String(c.supplier_name ?? 'Proveedor').trim();
  const origen = etiquetaOrigen(c.origen);

  return (nested as Array<{
    descripcion: string | null;
    item_code: string | null;
    cantidad: number | null;
  }>).flatMap((l) => {
    const articulo = String(l.descripcion ?? '').trim();
    if (!articulo) return [];
    const linea: LineaMaterialCompraTelegram = {
      fecha,
      factura,
      proveedor,
      origen,
      articulo,
      codigo: String(l.item_code ?? '').trim(),
      cantidad: Number(l.cantidad) > 0 ? Number(l.cantidad) : 0,
    };
    if (c.estado) linea.estado = c.estado;
    return [linea];
  });
}

function lineasDesdeCanalUi(
  cab: ReturnType<typeof mapCanalPendienteACompraLista>,
  lineas: CompraLineaUi[],
): LineaMaterialCompraTelegram[] {
  const fecha = String(cab.fecha ?? cab.created_at ?? '').slice(0, 10);
  const factura = String(cab.invoice_number ?? 'S/N').trim();
  const proveedor = String(cab.supplier_name ?? 'Proveedor').trim();
  const origen = etiquetaOrigen(cab.origen);

  if (!lineas.length) {
    return [
      {
        fecha,
        factura,
        proveedor,
        origen,
        articulo: '(factura sin detalle de líneas)',
        codigo: '',
        cantidad: 0,
        estado: cab.estado,
      },
    ];
  }

  return lineas
    .filter((l) => l.descripcion.trim())
    .map((l) => ({
      fecha,
      factura,
      proveedor,
      origen,
      articulo: l.descripcion.trim(),
      codigo: String(l.item_code ?? '').trim(),
      cantidad: Number(l.cantidad) > 0 ? Number(l.cantidad) : 0,
      estado: cab.estado,
    }));
}

/** Misma lógica que el cuadro web: contabilidad + canal Telegram, filtro por fecha efectiva. */
export async function cargarMaterialesComprasPeriodo(
  supabase: SupabaseClient,
  periodo: PeriodoComprasTelegram,
  refDate = todayIsoVenezuela(),
): Promise<{ lineas: LineaMaterialCompraTelegram[]; rango: { desde: string; hasta: string } }> {
  const rango = rangoFechasPeriodo(periodo, refDate);
  if (!rango) return { lineas: [], rango: { desde: refDate, hasta: refDate } };

  const [comprasRes, canalRes] = await Promise.all([
    supabase
      .from('contabilidad_compras')
      .select(
        'id,fecha,created_at,invoice_number,supplier_name,origen,estado,purchase_invoice_id,contabilidad_compra_lineas(descripcion,item_code,cantidad)',
      )
      .order('created_at', { ascending: false })
      .limit(MAX_COMPRAS),
    supabase
      .from('ci_facturas_canal_pendientes')
      .select(
        'id,canal,estado,proyecto_id,entidad_id,ubicacion_destino_id,purchase_invoice_id,document_file_name,document_storage_path,mensaje_error,created_at,extracted',
      )
      .in('estado', [...ESTADOS_CANAL_LISTA])
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  if (comprasRes.error?.code === '42P01') {
    throw new Error('Tabla contabilidad_compras no disponible. Aplique migraciones de compras.');
  }
  if (comprasRes.error) throw new Error(comprasRes.error.message);

  const comprasEnRango = ((comprasRes.data ?? []) as CompraRowDb[]).filter((c) =>
    compraEnRangoFechas(c, rango),
  );

  const invoiceIdsContabilidad = new Set(
    comprasEnRango.map((c) => c.purchase_invoice_id).filter((id): id is string => Boolean(id)),
  );

  const lineas: LineaMaterialCompraTelegram[] = [];

  for (const row of comprasEnRango) {
    const det = lineasDesdeContabilidad(row);
    if (det.length) lineas.push(...det);
    else {
      lineas.push({
        fecha: String(row.fecha ?? row.created_at ?? '').slice(0, 10),
        factura: String(row.invoice_number ?? 'S/N').trim(),
        proveedor: String(row.supplier_name ?? 'Proveedor').trim(),
        origen: etiquetaOrigen(row.origen),
        articulo: '(factura sin detalle de líneas)',
        codigo: '',
        cantidad: 0,
        estado: row.estado ?? undefined,
      });
    }
  }

  if (!canalRes.error?.code || canalRes.error.code !== '42P01') {
    if (canalRes.error) throw new Error(canalRes.error.message);

    for (const raw of (canalRes.data ?? []) as CanalPendienteParaLista[]) {
      const cab = mapCanalPendienteACompraLista(raw);
      if (!compraEnRangoFechas(cab, rango)) continue;
      if (raw.purchase_invoice_id && invoiceIdsContabilidad.has(raw.purchase_invoice_id)) {
        continue;
      }
      const det = lineasDesdeCanalUi(cab, lineasDesdeExtractedCanal(raw.extracted));
      lineas.push(...det);
    }
  }

  lineas.sort((a, b) => {
    const fc = b.fecha.localeCompare(a.fecha);
    if (fc !== 0) return fc;
    return a.articulo.localeCompare(b.articulo, 'es');
  });

  return { lineas, rango };
}
