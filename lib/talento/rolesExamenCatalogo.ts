/**
 * Catálogo canónico de roles de examen (banco + semáforo).
 * Personal (vacante obrero/empleado) ≠ rol_examen; el oficio solo afina vía Psique.
 */

export const ROLES_EXAMEN = [
  'obrero',
  'vigilante',
  'tecnico',
  'empleado',
  'programador',
] as const;

export type RolExamenCanonico = (typeof ROLES_EXAMEN)[number];

export type RolExamenUiMeta = {
  value: RolExamenCanonico;
  /** Etiqueta corta en botones */
  label: string;
  /** Campo vs oficina */
  grupo: 'campo' | 'oficina';
  /** Una línea para el banco */
  resumen: string;
  motor: 'abc' | 'tripode';
};

export const ROLES_EXAMEN_UI: readonly RolExamenUiMeta[] = [
  {
    value: 'obrero',
    label: 'Obrero (campo)',
    grupo: 'campo',
    resumen: '20 situacionales ABC · semáforo ABC',
    motor: 'abc',
  },
  {
    value: 'vigilante',
    label: 'Vigilante',
    grupo: 'campo',
    resumen: '20 situacionales ABC · semáforo ABC',
    motor: 'abc',
  },
  {
    value: 'tecnico',
    label: 'Técnico de obra',
    grupo: 'campo',
    resumen: '20 situacionales (4 opc.) + 5 lógica · trípode',
    motor: 'tripode',
  },
  {
    value: 'empleado',
    label: 'Empleado (oficina)',
    grupo: 'oficina',
    resumen: '20 frecuencia + 5 lógica · trípode',
    motor: 'tripode',
  },
  {
    value: 'programador',
    label: 'Programador / TI',
    grupo: 'oficina',
    resumen: '20 frecuencia + 5 lógica TI · trípode',
    motor: 'tripode',
  },
] as const;

export function esRolExamenCanonico(v: string | null | undefined): v is RolExamenCanonico {
  return (ROLES_EXAMEN as readonly string[]).includes(String(v ?? '').trim());
}

export function etiquetaRolExamenCatalogo(rol: string | null | undefined): string {
  const r = String(rol ?? '').trim();
  const hit = ROLES_EXAMEN_UI.find((x) => x.value === r);
  return hit?.label ?? (r || '—');
}

/** Default de producto (construcción): obrero de campo ABC. */
export const ROL_EXAMEN_DEFAULT: RolExamenCanonico = 'obrero';

/**
 * Ajusta el rol sugerido por Psique según tipo de vacante (requisición).
 */
export function alinearRolExamenConTipoVacante(
  rolSugerido: RolExamenCanonico | null | undefined,
  tipoVacante: string | null | undefined,
): RolExamenCanonico {
  let rol: RolExamenCanonico = esRolExamenCanonico(rolSugerido)
    ? rolSugerido
    : ROL_EXAMEN_DEFAULT;
  const tipo = String(tipoVacante ?? '').toLowerCase();

  if (tipo.includes('obrero')) {
    if (rol === 'programador' || rol === 'empleado') rol = 'obrero';
    else if (rol !== 'vigilante' && rol !== 'tecnico') rol = 'obrero';
    return rol;
  }

  if (tipo.includes('empleado')) {
    if (rol === 'obrero' || rol === 'tecnico') rol = 'empleado';
    return rol;
  }

  return rol;
}
