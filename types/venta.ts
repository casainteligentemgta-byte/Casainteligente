/**
 * Tipos para ventas y líneas de venta.
 * Coinciden con las tablas public.ventas y public.venta_items en Supabase.
 */
export interface Venta {
  id: string;
  /** Cliente jurídico (mutuamente excluyente con persona_id) */
  empresa_id: string | null;
  /** Cliente físico (mutuamente excluyente con empresa_id) */
  persona_id: string | null;
  fecha: string;
  importe_total: string; // numeric
  estado: 'pendiente' | 'pagada' | 'cancelada';
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface VentaItem {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: string; // numeric
  precio_unitario: string; // numeric
  subtotal: string; // numeric
}

