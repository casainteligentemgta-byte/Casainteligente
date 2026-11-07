import { esDescripcionAuditoriaCco } from '@/lib/contabilidad/compraEsAuditoriaCco';

export type LineaResumenProducto = {
  descripcion?: string | null;
};

export function lineasProductoVisibles<T extends LineaResumenProducto>(
  lineas: T[] | undefined | null,
): T[] {
  if (!Array.isArray(lineas)) return [];
  return lineas.filter((l) => !esDescripcionAuditoriaCco(String(l.descripcion ?? '')));
}

/**
 * Resumen de la columna Producto: primera descripción visible y cuántas líneas más hay.
 * `countHint` cubre embeds `{ count }` cuando no vienen las filas.
 */
export function resumenProductoFactura(
  lineas: LineaResumenProducto[] | undefined | null,
  countHint = 0,
): { primera: string; total: number; extra: number } {
  const visibles = lineasProductoVisibles(lineas);
  const primera = String(visibles[0]?.descripcion ?? '').trim();
  const total = visibles.length > 0 ? visibles.length : Math.max(0, countHint);
  return {
    primera,
    total,
    extra: primera ? Math.max(0, total - 1) : 0,
  };
}

export function etiquetaProductoFactura(resumen: { primera: string; total: number }): string {
  if (resumen.primera) return resumen.primera;
  if (resumen.total <= 0) return '';
  return resumen.total === 1 ? '1 producto' : `${resumen.total} productos`;
}
