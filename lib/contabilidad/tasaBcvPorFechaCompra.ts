import { tasaBcvCompra } from '@/lib/contabilidad/comprasMontos';

/** Tasa BCV de la compra: la guardada en factura o la del día `fecha` (no la de hoy). */
export function tasaBcvPorFechaCompra(
  compra: { fecha?: string | null; tasa_bcv_ves_por_usd?: number | null },
  tasaPorFecha: (fecha: string) => number | null,
): number | null {
  const enFactura = tasaBcvCompra(compra);
  if (enFactura != null) return enFactura;
  return tasaPorFecha((compra.fecha ?? '').slice(0, 10));
}
