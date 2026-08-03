/**
 * Datos de obra que el PM completa una vez por proyecto para agilizar contratos laborales.
 * RRHH no debe pedir estos campos por cada obrero.
 */

export type DueñoDatoContrato = 'pm' | 'legal_admin' | 'obrero' | 'rrhh';

export const ETIQUETA_DUEÑO_DATO_CONTRATO: Record<DueñoDatoContrato, string> = {
  pm: 'PM / obra',
  legal_admin: 'Legal / Admin',
  obrero: 'Obrero (planilla)',
  rrhh: 'RRHH',
};

export type CampoObraContratoPmId =
  | 'ubicacion'
  | 'fase_tecnica'
  | 'horario_semanal'
  | 'punto_encuentro';

export type CampoObraContratoPm = {
  id: CampoObraContratoPmId;
  etiqueta: string;
  ayuda: string;
  valor: string | null;
  completo: boolean;
};

export type ChecklistObraContratoPm = {
  listos: boolean;
  campos: CampoObraContratoPm[];
  faltantes: CampoObraContratoPm[];
};

export type DatosObraContratoPmInput = {
  ubicacion?: string | null;
  fase_tecnica_contrato?: string | null;
  horario_semanal_obra_default?: string | null;
  punto_encuentro_transporte_contrato?: string | null;
};

function trimOrNull(v: string | null | undefined): string | null {
  const t = typeof v === 'string' ? v.trim() : '';
  return t || null;
}

/** True si el texto es vacío o solo guiones / underscores de plantilla. */
export function valorPlantillaEfectivamenteVacio(raw: string | null | undefined): boolean {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t) return true;
  // Guiones de relleno: ______ o solo puntos/espacios
  if (/^[_\s.]{3,}$/.test(t)) return true;
  if (/^_{2,}\s*(USD|Bs\.?|VES)?\.?$/i.test(t)) return true;
  return false;
}

export function evaluarChecklistObraContratoPm(input: DatosObraContratoPmInput): ChecklistObraContratoPm {
  const ubicacion = trimOrNull(input.ubicacion);
  const fase = trimOrNull(input.fase_tecnica_contrato);
  const horario = trimOrNull(input.horario_semanal_obra_default);
  const punto = trimOrNull(input.punto_encuentro_transporte_contrato);

  const campos: CampoObraContratoPm[] = [
    {
      id: 'ubicacion',
      etiqueta: 'Lugar / ubicación de la obra',
      ayuda: 'Texto de ubicación del proyecto (lugar de prestación en cláusula quinta).',
      valor: ubicacion,
      completo: Boolean(ubicacion),
    },
    {
      id: 'fase_tecnica',
      etiqueta: 'Fase técnica (cláusula PRIMERA)',
      ayuda: 'Ej.: estructura, acabados, instalaciones — una vez por obra.',
      valor: fase,
      completo: Boolean(fase),
    },
    {
      id: 'horario_semanal',
      etiqueta: 'Horario semanal de obra',
      ayuda: 'Horario por defecto en contratos si el obrero no tiene uno propio.',
      valor: horario,
      completo: Boolean(horario),
    },
    {
      id: 'punto_encuentro',
      etiqueta: 'Punto de encuentro del transporte',
      ayuda: 'Parada del transporte gratuito (cláusula del contrato).',
      valor: punto,
      completo: Boolean(punto),
    },
  ];

  const faltantes = campos.filter((c) => !c.completo);
  return { listos: faltantes.length === 0, campos, faltantes };
}

/** Dueño sugerido por placeholder de la plantilla `contrato_obrero`. */
export function dueñoPlaceholderContrato(id: string): DueñoDatoContrato {
  if (
    id.startsWith('PATRON_') ||
    id.startsWith('REP_LEGAL_') ||
    id === 'PATRON_INSCRIPCION_RM' ||
    id === 'PATRON_REPRESENTANTE'
  ) {
    return 'legal_admin';
  }
  if (id.startsWith('EMPLEADO_')) return 'obrero';
  if (
    id === 'OBRA_NOMBRE' ||
    id === 'OBRA_UBICACION' ||
    id === 'OBRA_PUNTO_ENC_TRANSPORTE' ||
    id === 'CONTRATO_FASE_TECNICA' ||
    id === 'CONTRATO_HORARIO_CUARTA' ||
    id === 'CONTRATO_LUGAR_QUINTA' ||
    id === 'CONTRATO_LUGAR_PRESTACION'
  ) {
    return 'pm';
  }
  return 'rrhh';
}
