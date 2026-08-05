/**
 * Concordancia de género en comparecencia del contrato individual de trabajo.
 */

export type GeneroContrato = 'M' | 'F';

export type TratoTrabajadorContrato = {
  articuloCiudadano: string;
  denominacion: string;
  denominacionFirma: string;
  trabajadorMinuscula: string;
};

/** Normaliza género desde flags o texto (Sr/Sra, M/F, etc.). */
export function normalizarGeneroContrato(v: unknown): GeneroContrato | undefined {
  if (v === true) return 'F';
  if (v === false) return 'M';
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return undefined;
  if (
    s === 'F' ||
    s === 'FEMENINO' ||
    s === 'FEMENINA' ||
    s === 'SRA' ||
    s === 'SRA.' ||
    s === 'MUJER'
  ) {
    return 'F';
  }
  if (
    s === 'M' ||
    s === 'MASCULINO' ||
    s === 'MASCULINA' ||
    s === 'SR' ||
    s === 'SR.' ||
    s === 'HOMBRE'
  ) {
    return 'M';
  }
  return undefined;
}

/**
 * Infere género del trabajador cuando no hay campo explícito.
 * Orden: genero/femenino → estado civil → nacionalidad flexionada → masculino.
 */
export function inferirFemeninoTrabajador(opts: {
  genero?: GeneroContrato | string | null;
  femenino?: boolean | null;
  estadoCivil?: string | null;
  nacionalidad?: string | null;
}): boolean {
  const g = normalizarGeneroContrato(opts.genero);
  if (g === 'F' || opts.femenino === true) return true;
  if (g === 'M' || opts.femenino === false) return false;

  const ec = (opts.estadoCivil ?? '').trim().toLowerCase();
  if (/\b(soltera|casada|divorciada|viuda|concubina)\b/.test(ec)) return true;
  if (/\b(soltero|casado|divorciado|viudo|concubino)\b/.test(ec)) return false;

  const nat = (opts.nacionalidad ?? '').trim().toLowerCase();
  if (/^venezolana$/.test(nat)) return true;
  if (/^venezolano$/.test(nat)) return false;

  return false;
}

/**
 * Acuerda adjetivos de nacionalidad frecuentes (p. ej. venezolano/venezolana).
 * Si no hay valor, usa venezolano/venezolana según género.
 */
export function nacionalidadAcordada(
  nacionalidad: string | null | undefined,
  femenino: boolean,
): string {
  const raw = (nacionalidad ?? '').trim();
  if (!raw || /^venezolan[oa]$/i.test(raw)) {
    return femenino ? 'venezolana' : 'venezolano';
  }

  // Demónimos comunes terminados en -o / -a
  if (femenino && /[oO]$/.test(raw) && !/[aA]$/.test(raw)) {
    return `${raw.slice(0, -1)}a`;
  }
  if (!femenino && /[aA]$/.test(raw) && !/(ista|ense)$/i.test(raw)) {
    return `${raw.slice(0, -1)}o`;
  }

  return raw;
}

/** Forma canónica al guardar representante venezolano según género (Sr/Sra). */
export function nacionalidadVenezolanaRepresentante(femenino: boolean): string {
  return femenino ? 'Venezolana' : 'Venezolano';
}

export function tratoTrabajadorContrato(femenino: boolean): TratoTrabajadorContrato {
  if (femenino) {
    return {
      articuloCiudadano: 'la ciudadana',
      denominacion: 'LA TRABAJADORA',
      denominacionFirma: 'POR LA TRABAJADORA',
      trabajadorMinuscula: 'la trabajadora',
    };
  }
  return {
    articuloCiudadano: 'el ciudadano',
    denominacion: 'EL TRABAJADOR',
    denominacionFirma: 'POR EL TRABAJADOR',
    trabajadorMinuscula: 'el trabajador',
  };
}
