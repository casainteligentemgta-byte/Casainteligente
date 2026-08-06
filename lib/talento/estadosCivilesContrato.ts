/**
 * Estados civiles usados en contratos laborales (comparecencia).
 * Incluye formas masculina y femenina para concordancia en el PDF.
 */
export const ESTADOS_CIVILES_CONTRATO = [
  'Soltero',
  'Soltera',
  'Casado',
  'Casada',
  'Divorciado',
  'Divorciada',
  'Viudo',
  'Viuda',
  'Concubino',
  'Concubina',
  'Unión estable de hecho',
] as const;

export type EstadoCivilContrato = (typeof ESTADOS_CIVILES_CONTRATO)[number];

export const ESTADO_CIVIL_CONTRATO_DEFAULT: EstadoCivilContrato = 'Soltero';
