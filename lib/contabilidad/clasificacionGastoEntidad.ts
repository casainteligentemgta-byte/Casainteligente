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

/** Etiquetas cortas para botones Telegram (comprador → gasto entidad). */
export const ETIQUETAS_GASTO_ENTIDAD_TELEGRAM: Record<ClasificacionGastoEntidad, string> = {
  operacional: 'Gasto operativo',
  administrativo: 'Gasto administrativo',
  servicio: 'Servicios',
};

export const ETIQUETA_SIN_CLASIFICAR_GASTO_ENTIDAD = 'Sin clasificar';

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
  if (!parsed) return ETIQUETA_SIN_CLASIFICAR_GASTO_ENTIDAD;
  return ETIQUETAS[parsed];
}

export function clasificacionGastoEntidadValida(v: unknown): v is ClasificacionGastoEntidad {
  return parseClasificacionGastoEntidad(v) != null;
}
