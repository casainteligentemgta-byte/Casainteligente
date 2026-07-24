/** Mapeo display CRM ↔ estados reales de ci_proyectos. */

export type ProyectoClienteRow = {
  id: string;
  nombre: string;
  estado: string;
  monto_aproximado?: number | string | null;
  obra_precio_venta_usd?: number | string | null;
  entidad_id?: string | null;
  tipo_proyecto?: string | null;
  ci_entidades?: { nombre?: string | null; rif?: string | null } | null;
};

export function tipoClienteCrm(customer: {
  customer_type?: string | null;
  tipo?: string | null;
}): 'Empresa' | 'Residencial' {
  if (customer.customer_type === 'juridico') return 'Empresa';
  const t = String(customer.tipo ?? '').toLowerCase();
  if (t.includes('empresa') || t.includes('jurid')) return 'Empresa';
  return 'Residencial';
}

export function montoObraUsd(row: {
  monto_aproximado?: number | string | null;
  obra_precio_venta_usd?: number | string | null;
}): number {
  const venta = Number(row.obra_precio_venta_usd);
  if (Number.isFinite(venta) && venta > 0) return venta;
  const aprox = Number(row.monto_aproximado);
  return Number.isFinite(aprox) ? aprox : 0;
}

/** Etiquetas que entiende ClienteDrawer (CRM). */
export function etiquetaEstadoObraCrm(estado: string): string {
  const e = String(estado ?? '').toLowerCase();
  if (e === 'cerrado' || e === 'entregado') return 'Finalizado';
  if (e === 'ejecucion') return 'Ejecucion';
  if (e === 'presupuestado' || e === 'levantamiento' || e === 'nuevo') return 'Cotizacion';
  return estado || 'Cotizacion';
}

export function etiquetaEstadoObraLegible(estado: string): string {
  const map: Record<string, string> = {
    nuevo: 'Nuevo',
    levantamiento: 'Levantamiento',
    presupuestado: 'Presupuestado',
    ejecucion: 'En ejecución',
    entregado: 'Entregado',
    cerrado: 'Cerrado',
    cancelado: 'Cancelado',
  };
  const e = String(estado ?? '').toLowerCase();
  return map[e] ?? (estado || '—');
}

export function hrefProyectoObra(id: string, tipoProyecto?: string | null): string {
  if (tipoProyecto === 'talento') {
    return `/proyectos/${id}/finanzas`;
  }
  return `/proyectos/modulo/${id}`;
}

export type PatronoObraResumen = {
  entidadId: string;
  nombre: string;
  rif: string | null;
  obraCount: number;
};

/** Patronos únicos a partir de obras del cliente (solo lectura). */
export function agruparPatronosDesdeObras(
  obras: Array<{
    entidadId?: string | null;
    entidadNombre?: string | null;
    entidadRif?: string | null;
  }>,
): PatronoObraResumen[] {
  const map = new Map<string, PatronoObraResumen>();
  for (const o of obras) {
    const id = String(o.entidadId ?? '').trim();
    if (!id || !o.entidadNombre?.trim()) continue;
    const prev = map.get(id);
    if (prev) {
      prev.obraCount += 1;
    } else {
      map.set(id, {
        entidadId: id,
        nombre: o.entidadNombre.trim(),
        rif: o.entidadRif?.trim() || null,
        obraCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function nombreDisplayCustomer(row: {
  nombre?: string | null;
  apellido?: string | null;
  razon_social?: string | null;
}): string {
  const rs = String(row.razon_social ?? '').trim();
  if (rs) return rs;
  return [row.nombre, row.apellido].filter(Boolean).join(' ').trim();
}
