/** Nombres de depósitos que son almacén central (no deben listarse como proyecto). */
export const NOMBRES_DEPOSITO_ALMACEN_CENTRAL = new Set(
  ['la oficina', 'terreno jc'].map((s) => s.toLowerCase()),
);

export function esNombreDepositoAlmacenCentral(nombre: string | null | undefined): boolean {
  const n = String(nombre ?? '')
    .trim()
    .toLowerCase();
  return NOMBRES_DEPOSITO_ALMACEN_CENTRAL.has(n);
}

export type DepositoEntidadRow = {
  id: string;
  entidad_id?: string | null;
};

/** Depósitos cuyo patrono coincide con la entidad del filtro. */
export function depositIdsPorEntidad(
  deposits: DepositoEntidadRow[],
  entidadId: string,
): string[] {
  const eid = entidadId.trim();
  if (!eid) return [];
  return deposits.filter((d) => String(d.entidad_id ?? '').trim() === eid).map((d) => d.id);
}
