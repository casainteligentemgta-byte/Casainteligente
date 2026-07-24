/** Estados del flujo RRHH de contrato (columna `estado_contrato`). */
export const ESTADO_CONTRATO = {
  GENERADO_PENDIENTE: 'generado_pendiente',
  ACEPTADO_DIGITAL: 'aceptado_digital',
  FIRMADO_Y_ARCHIVADO: 'firmado_y_archivado',
  /** Legado — se normaliza al leer */
  GENERADO: 'generado',
  FIRMADO_ELECTRONICO: 'firmado_electronico',
  FIRMADO_ACTIVO: 'firmado_activo',
} as const;

export type EstadoContratoRrhh = (typeof ESTADO_CONTRATO)[keyof typeof ESTADO_CONTRATO];

export function normalizarEstadoContrato(raw: string | null | undefined): EstadoContratoRrhh {
  const e = (raw ?? '').trim();
  switch (e) {
    case ESTADO_CONTRATO.GENERADO_PENDIENTE:
    case ESTADO_CONTRATO.ACEPTADO_DIGITAL:
    case ESTADO_CONTRATO.FIRMADO_Y_ARCHIVADO:
      return e;
    case ESTADO_CONTRATO.GENERADO:
      return ESTADO_CONTRATO.GENERADO_PENDIENTE;
    case ESTADO_CONTRATO.FIRMADO_ELECTRONICO:
      return ESTADO_CONTRATO.ACEPTADO_DIGITAL;
    case ESTADO_CONTRATO.FIRMADO_ACTIVO:
      return ESTADO_CONTRATO.FIRMADO_Y_ARCHIVADO;
    default:
      return ESTADO_CONTRATO.GENERADO_PENDIENTE;
  }
}

export function estadoContratoAlGuardar(canonical: EstadoContratoRrhh): string {
  return canonical;
}

export function paso1Completado(estado: string | null | undefined, whatsappEnviadoAt?: string | null): boolean {
  const n = normalizarEstadoContrato(estado);
  return Boolean(whatsappEnviadoAt) || n !== ESTADO_CONTRATO.GENERADO_PENDIENTE;
}

export function paso2Completado(
  estado: string | null | undefined,
  aceptadoAt?: string | null,
): boolean {
  if (aceptadoAt) return true;
  const n = normalizarEstadoContrato(estado);
  return n === ESTADO_CONTRATO.ACEPTADO_DIGITAL || n === ESTADO_CONTRATO.FIRMADO_Y_ARCHIVADO;
}

export function paso3Completado(
  estado: string | null | undefined,
  archivadoAt?: string | null,
): boolean {
  if (archivadoAt) return true;
  return normalizarEstadoContrato(estado) === ESTADO_CONTRATO.FIRMADO_Y_ARCHIVADO;
}
