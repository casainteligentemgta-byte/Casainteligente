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

function primerNombreNormalizado(nombre: string | null | undefined): string {
  const raw = (nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Nombres femeninos frecuentes en VE (refuerzo cuando no hay genero en BD). */
const NOMBRES_FEMENINOS = new Set([
  'carla',
  'maria',
  'ana',
  'carmen',
  'rosa',
  'lucia',
  'laura',
  'andrea',
  'patricia',
  'jennifer',
  'gabriela',
  'valentina',
  'isabella',
  'daniela',
  'alejandra',
  'mariana',
  'sofia',
  'camila',
  'paola',
  'yolanda',
  'mercedes',
  'beatriz',
  'gloria',
  'irene',
  'veronica',
  'elizabeth',
  'karina',
  'karla',
  'yessica',
  'jessica',
  'nancy',
  'yanet',
  'yaneth',
  'lisbeth',
  'mileidy',
  'genesis',
  'genesis',
  'thais',
  'thaís',
]);

const NOMBRES_MASCULINOS = new Set([
  'jose',
  'juan',
  'luis',
  'carlos',
  'jesus',
  'pedro',
  'miguel',
  'angel',
  'andres',
  'diego',
  'daniel',
  'david',
  'alejandro',
  'francisco',
  'antonio',
  'manuel',
  'rafael',
  'ricardo',
  'roberto',
  'sebastian',
  'victor',
  'edgar',
  'hector',
  'ivan',
  'jorge',
  'julio',
  'omar',
  'oscar',
  'pablo',
  'ramon',
  'sergio',
  'tomas',
  'william',
  'yosmar',
  'josue',
]);

/**
 * Heurística de primer nombre. `undefined` = sin indicios claros.
 * No usar sola como verdad absoluta; va detrás de genero/estado civil.
 */
export function pareceNombreFemenino(nombre: string | null | undefined): boolean | undefined {
  const p = primerNombreNormalizado(nombre);
  if (!p) return undefined;
  if (NOMBRES_FEMENINOS.has(p)) return true;
  if (NOMBRES_MASCULINOS.has(p)) return false;
  // Terminación en -a muy frecuente en femeninos (Carla, María…).
  if (p.length >= 3 && p.endsWith('a')) return true;
  return undefined;
}

function estadoCivilFemenino(estadoCivil: string | null | undefined): boolean | undefined {
  const ec = (estadoCivil ?? '').trim().toLowerCase();
  if (!ec) return undefined;
  if (/\b(soltera|casada|divorciada|viuda|concubina)\b/.test(ec)) return true;
  if (/\b(soltero|casado|divorciado|viudo|concubino)\b/.test(ec)) return false;
  return undefined;
}

/**
 * Género del trabajador para el contrato.
 * No usa la nacionalidad guardada (el default histórico «venezolana» sesgaba a femenino).
 * Orden: flag/genero → estado civil → primer nombre → masculino.
 */
export function inferirFemeninoTrabajador(opts: {
  genero?: GeneroContrato | string | null;
  femenino?: boolean | null;
  estadoCivil?: string | null;
  nacionalidad?: string | null;
  nombre?: string | null;
}): boolean {
  const g = normalizarGeneroContrato(opts.genero);
  if (g === 'F' || opts.femenino === true) return true;
  if (g === 'M' || opts.femenino === false) return false;

  const ec = estadoCivilFemenino(opts.estadoCivil);
  if (ec != null) return ec;

  const porNombre = pareceNombreFemenino(opts.nombre);
  if (porNombre != null) return porNombre;

  return false;
}

/**
 * Género del representante legal (Sra / Sr).
 * Orden: flag/genero → estado civil → primer nombre → masculino.
 */
export function inferirFemeninoRepresentante(opts: {
  genero?: GeneroContrato | string | null;
  femenino?: boolean | null;
  estadoCivil?: string | null;
  nacionalidad?: string | null;
  nombre?: string | null;
}): boolean {
  const g = normalizarGeneroContrato(opts.genero);
  if (g === 'F' || opts.femenino === true) return true;
  if (g === 'M' || opts.femenino === false) return false;

  const ec = estadoCivilFemenino(opts.estadoCivil);
  if (ec != null) return ec;

  const porNombre = pareceNombreFemenino(opts.nombre);
  if (porNombre != null) return porNombre;

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
  // «Venezolano», «venezolana», «Venezolano(a)», etc.
  if (!raw || /^venezolan[oa](\(a\))?$/i.test(raw)) {
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

export function tratoRepresentanteContrato(femenino: boolean): {
  articuloCiudadano: string;
} {
  return {
    articuloCiudadano: femenino ? 'la Ciudadana' : 'el Ciudadano',
  };
}
