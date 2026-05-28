/**
 * Inventario por ubicación, compras, transferencias (cadena de custodia)
 * e imputación por partidas presupuestarias.
 * @see supabase/migrations/180_inventario_compras_custodia_partidas.sql
 */

import type { InventoryItem } from '@/types/inventory';

// ── Ubicaciones ─────────────────────────────────────────────────────────────

export type TipoUbicacion =
  | 'almacen_central'
  | 'almacen_movil'
  | 'obra'
  | 'garantias'
  | 'cuarentena';

/** @deprecated Usar TipoUbicacion */
export type InvUbicacionTipo = TipoUbicacion;

/** Fila en BD (`inv_ubicaciones`). */
export interface InvUbicacionRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoUbicacion;
  descripcion?: string | null;
  deposit_id: string | null;
  ci_proyecto_id: string | null;
  ubicacion_padre_id: string | null;
  activo: boolean;
  notas?: string | null;
  created_at: string;
  updated_at?: string;
}

/** Modelo de UI con árbol de subsitios. */
export interface UbicacionInventario {
  id: string;
  nombre: string;
  tipo: TipoUbicacion;
  descripcion?: string;
  activo: boolean;
  /** Obra vinculada (`ci_proyectos.id`) cuando tipo = obra o subsitio de obra. */
  obra_id?: string;
  codigo?: string;
  deposit_id?: string | null;
  ubicacion_padre_id?: string;
  subsitios?: UbicacionInventario[];
  created_at: string;
  updated_at?: string;
  proyecto?: { id: string; nombre: string } | null;
}

/** @deprecated Usar UbicacionInventario */
export type InvUbicacion = UbicacionInventario;

export function mapUbicacionInventario(row: InvUbicacionRow): UbicacionInventario {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    tipo: row.tipo,
    descripcion: row.descripcion ?? row.notas ?? undefined,
    activo: row.activo,
    obra_id: row.ci_proyecto_id ?? undefined,
    deposit_id: row.deposit_id,
    ubicacion_padre_id: row.ubicacion_padre_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Construye árbol de ubicaciones para listados en front-end. */
export function buildArbolUbicaciones(
  flat: UbicacionInventario[],
): UbicacionInventario[] {
  const byId = new Map(flat.map((u) => [u.id, { ...u, subsitios: [] as UbicacionInventario[] }]));
  const roots: UbicacionInventario[] = [];

  for (const u of Array.from(byId.values())) {
    const padreId = u.ubicacion_padre_id;
    if (padreId && byId.has(padreId)) {
      byId.get(padreId)!.subsitios!.push(u);
    } else {
      roots.push(u);
    }
  }

  const sortByNombre = (a: UbicacionInventario, b: UbicacionInventario) =>
    a.nombre.localeCompare(b.nombre, 'es');
  const sortRec = (nodes: UbicacionInventario[]) => {
    nodes.sort(sortByNombre);
    for (const n of nodes) {
      if (n.subsitios?.length) sortRec(n.subsitios);
    }
  };
  sortRec(roots);
  return roots;
}

export interface InventarioStock {
  id: string;
  ubicacion_id: string;
  material_id: string;
  cantidad_disponible: number;
  cantidad_reservada: number;
  cantidad_en_transito_entrante: number;
  updated_at?: string;
  ubicacion?: UbicacionInventario;
  material?: InventoryItem;
}

// ── Series / trazabilidad ───────────────────────────────────────────────────

export type SerieProductoEstado =
  | 'en_stock'
  | 'en_transito'
  | 'en_obra'
  | 'garantia'
  | 'merma'
  | 'baja';

export interface SerieProducto {
  id: string;
  material_id: string;
  numero_serie: string;
  estado: SerieProductoEstado;
  ubicacion_id: string | null;
  ci_proyecto_id: string | null;
  compra_linea_id: string | null;
  transferencia_linea_id: string | null;
  proveedor_nombre: string | null;
  notas: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Compras ───────────────────────────────────────────────────────────────────

export type CompraCondicionPago = 'contado' | 'credito';
export type CompraFacturaEstado = 'borrador' | 'registrada' | 'anulada';

export interface CompraFactura {
  id: string;
  numero_factura: string;
  proveedor_rif: string | null;
  proveedor_nombre: string;
  fecha_emision: string;
  subtotal: number;
  impuesto: number;
  total: number;
  condicion_pago: CompraCondicionPago;
  dias_credito: number | null;
  documento_url: string | null;
  documento_storage_path: string | null;
  ubicacion_destino_id: string;
  estado: CompraFacturaEstado;
  purchase_invoice_id: string | null;
  registrado_por: string | null;
  registrada_at: string | null;
  created_at?: string;
  updated_at?: string;
  ubicacion_destino?: InvUbicacion;
  lineas?: CompraFacturaLinea[];
}

export interface CompraFacturaLinea {
  id: string;
  factura_id: string;
  material_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  requiere_serie: boolean;
  created_at?: string;
  material?: InventoryItem;
  series?: SerieProducto[];
}

export interface CompraFacturaInsert {
  numero_factura: string;
  proveedor_rif?: string;
  proveedor_nombre: string;
  fecha_emision?: string;
  subtotal?: number;
  impuesto?: number;
  total: number;
  condicion_pago: CompraCondicionPago;
  dias_credito?: number | null;
  documento_url?: string | null;
  documento_storage_path?: string | null;
  ubicacion_destino_id: string;
  lineas: Array<{
    material_id: string;
    descripcion?: string;
    cantidad: number;
    precio_unitario: number;
    requiere_serie?: boolean;
    numeros_serie?: string[];
  }>;
}

// ── Techo presupuestario por partida ────────────────────────────────────────

/** Resultado de validar cantidad contra techo (UI / cliente). */
export interface ValidacionPartida {
  permitido: boolean;
  diferencia: number;
  porcentajeExceso: number;
  /** true si hay exceso pero la BD/UI permiten continuar con justificación */
  requiereJustificacion: boolean;
}

export interface ObraPartidaMaterial {
  id: string;
  ci_proyecto_id: string;
  partida_id: string | null;
  ci_presupuesto_partida_id: string | null;
  material_id: string;
  cantidad_techo: number;
  monto_techo_usd: number | null;
  unidad: string;
  notas: string | null;
  created_at?: string;
  updated_at?: string;
  material?: InventoryItem;
}

/** Fila UI para despacho / imputación a partida (techo + consumo ya cargado). */
export interface PartidaDespachoFila {
  obra_partida_material_id: string;
  partida_id?: string | null;
  ci_presupuesto_partida_id?: string | null;
  nombre_partida: string;
  /** Techo (`cantidad_techo` en BD). */
  cantidad_presupuestada: number;
  /** Ya imputado/consumido en esa partida+material. */
  cantidad_asignada_real: number;
  unidad?: string;
}

// ── Transferencias y custodia ───────────────────────────────────────────────

export type TransferenciaEstado =
  | 'pendiente'
  | 'en_transito'
  | 'completado'
  | 'rechazado'
  | 'garantia';

export type TransferenciaTipoMovimiento =
  | 'transferencia'
  | 'salida_obra'
  | 'retorno_garantia'
  | 'retorno_merma';

export interface TransferenciaInventario {
  id: string;
  codigo: string;
  tipo_movimiento: TransferenciaTipoMovimiento;
  origen_ubicacion_id: string;
  destino_ubicacion_id: string;
  ci_proyecto_id: string | null;
  estado: TransferenciaEstado;
  usuario_despacha_id: string | null;
  usuario_transporta_id: string | null;
  usuario_recibe_id: string | null;
  despachado_at: string | null;
  recibido_at: string | null;
  observaciones: string | null;
  created_at?: string;
  updated_at?: string;
  origen?: InvUbicacion;
  destino?: InvUbicacion;
  lineas?: TransferenciaInventarioLinea[];
}

export interface TransferenciaInventarioLinea {
  id: string;
  transferencia_id: string;
  material_id: string;
  cantidad: number;
  cantidad_recibida: number;
  serie_id: string | null;
  created_at?: string;
  material?: InventoryItem;
  serie?: SerieProducto | null;
  imputaciones_partidas?: DetalleTransferenciaPartida[];
}

export interface DetalleTransferenciaPartida {
  id: string;
  transferencia_linea_id: string;
  partida_id: string | null;
  ci_presupuesto_partida_id: string | null;
  cantidad_imputada: number;
  exceso_presupuesto: boolean;
  justificacion_exceso: string | null;
  flagged_sobrecosto: boolean;
  created_at?: string;
}

/** Payload UI: distribuir cantidad de una línea entre partidas */
export interface ImputacionPartidaInput {
  partida_id?: string | null;
  ci_presupuesto_partida_id?: string | null;
  cantidad_imputada: number;
  justificacion_exceso?: string | null;
}

export interface TransferenciaInventarioInsert {
  codigo?: string;
  tipo_movimiento?: TransferenciaTipoMovimiento;
  origen_ubicacion_id: string;
  destino_ubicacion_id: string;
  ci_proyecto_id?: string | null;
  usuario_despacha_id: string;
  usuario_transporta_id: string;
  usuario_recibe_id: string;
  observaciones?: string | null;
  lineas: Array<{
    material_id: string;
    cantidad: number;
    serie_id?: string | null;
    imputaciones?: ImputacionPartidaInput[];
  }>;
}

/** Umbrales de alertas de despacho guardados por proyecto (`inv_despacho_alertas_proyecto`). */
export interface InvDespachoAlertasProyecto {
  ci_proyecto_id: string;
  exceso_advertencia_pct: number;
  exceso_critico_pct: number;
  saldo_informativo_pct: number;
  updated_at?: string;
}

/** Resumen de desviación presupuestaria para alertas en UI */
export interface AlertaExcesoPartida {
  partidaLabel: string;
  materialNombre: string;
  techo: number;
  consumido: number;
  exceso: number;
  requiereJustificacion: boolean;
  flagged_sobrecosto: boolean;
}
