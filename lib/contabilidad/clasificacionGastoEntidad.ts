export const CLASIFICACIONES_GASTO_ENTIDAD = [
  'operacional',
  'administrativo',
  'servicio',
] as const;

export type ClasificacionGastoEntidad = (typeof CLASIFICACIONES_GASTO_ENTIDAD)[number];

const ETIQUETAS: Record<ClasificacionGastoEntidad, string> = {
  operacional: 'Operacional',
  administrativo: 'Administrativo',
  servicio: 'Servicio',
};

export function parseClasificacionGastoEntidad(v: unknown): ClasificacionGastoEntidad | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'operacional' || s === 'administrativo' || s === 'servicio') return s;
  return null;
}

export function etiquetaClasificacionGastoEntidad(
  v: ClasificacionGastoEntidad | string | null | undefined,
): string {
  const parsed = parseClasificacionGastoEntidad(v);
  if (!parsed) return 'Sin clasificar';
  return ETIQUETAS[parsed];
}

export function clasificacionGastoEntidadValida(v: unknown): v is ClasificacionGastoEntidad {
  return parseClasificacionGastoEntidad(v) != null;
}
