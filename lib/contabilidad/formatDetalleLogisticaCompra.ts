import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';

export type CompraFacturaInventarioEmbed = {
  numero_factura?: string | null;
  estado?: string | null;
};

function formatFechaHoraLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Líneas de detalle puente contabilidad ↔ inventario para la tarjeta de compra. */
export function lineasDetallePuenteInventario(c: CompraListaUnificada): string[] {
  const lineas: string[] = [];

  if (c.cuarentena_rechazo_total) {
    lineas.push('Cuarentena: todas las líneas rechazadas (sin ingreso a stock).');
  }

  const cf = c.compra_factura;
  const cfRaw = cf as CompraFacturaInventarioEmbed | CompraFacturaInventarioEmbed[] | null | undefined;
  const facturaInv = Array.isArray(cfRaw) ? cfRaw[0] : cfRaw;

  if (c.compra_factura_id || facturaInv?.numero_factura) {
    const num = String(facturaInv?.numero_factura ?? '').trim();
    const est = String(facturaInv?.estado ?? '').trim();
    const ref = c.compra_factura_id ? c.compra_factura_id.slice(0, 8) : '';
    const partes = ['Inventario'];
    if (num) partes.push(`factura ${num}`);
    if (est) partes.push(`(${est})`);
    if (ref) partes.push(`· id ${ref}…`);
    lineas.push(partes.join(' '));
  }

  if (c.ingresado_almacen_at) {
    lineas.push(`Primer ingreso a stock: ${formatFechaHoraLocal(c.ingresado_almacen_at)}`);
  } else if (
    c.estado_logistica === 'en_almacen' ||
    c.estado_logistica === 'en_almacen_parcial'
  ) {
    lineas.push('Stock en almacén (fecha de ingreso pendiente de sincronizar).');
  }

  return lineas;
}

export function compraTieneDetallePuenteInventario(c: CompraListaUnificada): boolean {
  return lineasDetallePuenteInventario(c).length > 0;
}
