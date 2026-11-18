/**
 * Filtra las facturas del canal (Telegram) con los mismos criterios que la consulta de
 * contabilidad_compras, para que el cuadro no muestre facturas de otras entidades u obras.
 *
 * Valores de entidad/obra: '' = sin filtro; 'sin_entidad' / 'sin_proyecto' = sin asignar;
 * cualquier otro valor = id exacto.
 */
export type FiltrosCanalParaCompras = {
  entidadId?: string | null;
  proyectoId?: string | null;
  /** AAAA-MM-DD, inclusive. */
  desde?: string | null;
  /** AAAA-MM-DD, inclusive. */
  hasta?: string | null;
  proveedor?: string | null;
};

export type PendienteFiltrableCanal = {
  entidad_id?: string | null;
  proyecto_id?: string | null;
  created_at?: string | null;
  extracted?: { date?: string | null; supplier_name?: string | null } | null;
};

/** Fecha de la factura: la extraída por la IA; si no hay, la de carga (solo para filtrar). */
export function fechaFacturaCanal(p: PendienteFiltrableCanal): string {
  return String(p.extracted?.date ?? p.created_at ?? '').slice(0, 10);
}

export function filtrarPendientesCanalParaCompras<T extends PendienteFiltrableCanal>(
  pendientes: T[],
  f: FiltrosCanalParaCompras,
): T[] {
  const ent = String(f.entidadId ?? '').trim();
  const pro = String(f.proyectoId ?? '').trim();
  const desde = String(f.desde ?? '').slice(0, 10);
  const hasta = String(f.hasta ?? '').slice(0, 10);
  const prov = String(f.proveedor ?? '').trim();

  return pendientes.filter((p) => {
    if (ent === 'sin_entidad') {
      if (p.entidad_id) return false;
    } else if (ent && String(p.entidad_id ?? '') !== ent) {
      return false;
    }

    if (pro === 'sin_proyecto') {
      if (p.proyecto_id) return false;
    } else if (pro && String(p.proyecto_id ?? '') !== pro) {
      return false;
    }

    const fecha = fechaFacturaCanal(p);
    if (desde && fecha < desde) return false;
    if (hasta && fecha > hasta) return false;

    if (prov && String(p.extracted?.supplier_name ?? '').trim() !== prov) return false;

    return true;
  });
}
