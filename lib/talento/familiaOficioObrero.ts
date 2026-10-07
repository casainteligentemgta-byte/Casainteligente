/**
 * Familias de oficio para adecuar el bloque ABC del obrero.
 * No es un cuestionario por cada código GOE: se agrupa por riesgos/tareas similares.
 * Los ayudantes (y obrero de 1era. / apoyo de nivel 2) tienen banco propio.
 */

import { cargoPorCodigo } from '@/lib/constants/cargosObreros';

export const FAMILIAS_OFICIO_OBRERO = [
  'ayudante',
  'general',
  'obra_civil',
  'electricidad',
  'plomeria',
  'estructuras',
  'equipos',
  'vigilancia',
] as const;

/** Track de la evaluación unificada: ayudante vs oficio clasificado (1ª / 2ª / maestro). */
export type TrackEvaluacionObrero = 'ayudante' | 'clasificado';

/** Códigos GOE de apoyo / no clasificados (no 1ª ni 2ª de oficio). */
const CODIGOS_AYUDANTE = new Set([
  '1.1', // OBRERO DE 1era.
  '2.1', // AYUDANTE
  '2.2', // AUXILIAR DE DEPOSITO
  '2.5', // AYUDANTE DE OPERADORES
  '2.6', // AYUDANTE DE MECANICO DIESEL
  '2.7', // AYUDANTE DE TOPOGRAFO
  '2.8', // RASTRILLERO
  '2.9', // ESPESORISTA
  '2.10', // PALERO ASFALTICO
]);

export type FamiliaOficioObrero = (typeof FAMILIAS_OFICIO_OBRERO)[number];

export function esFamiliaOficioObrero(v: string): v is FamiliaOficioObrero {
  return (FAMILIAS_OFICIO_OBRERO as readonly string[]).includes(v);
}

export function etiquetaFamiliaOficio(familia: FamiliaOficioObrero): string {
  switch (familia) {
    case 'ayudante':
      return 'Ayudante';
    case 'obra_civil':
      return 'Obra civil / acabados';
    case 'electricidad':
      return 'Electricidad';
    case 'plomeria':
      return 'Plomería';
    case 'estructuras':
      return 'Estructuras / cabillas / soldadura';
    case 'equipos':
      return 'Equipos / choferes / operadores';
    case 'vigilancia':
      return 'Vigilancia';
    default:
      return 'Obra (general)';
  }
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function codigoGoENormalizado(raw?: string | null): string {
  return String(raw ?? '')
    .trim()
    .replace(',', '.')
    .replace(/\s+/g, '');
}

export function etiquetaTrackEvaluacion(track: TrackEvaluacionObrero): string {
  return track === 'ayudante' ? 'Ayudante' : 'Personal clasificado';
}

/**
 * Ayudante / obrero de 1era. / apoyo de nivel 2. No aplica a vigilante.
 */
export function esAyudanteTabulador(opts: {
  cargo?: string | null;
  rolExamen?: string | null;
  codigoGoE?: string | null;
}): boolean {
  const rol = (opts.rolExamen ?? '').trim().toLowerCase();
  if (rol === 'vigilante') return false;

  const cod = codigoGoENormalizado(opts.codigoGoE);
  const cat = cargoPorCodigo(cod);
  if (cat && CODIGOS_AYUDANTE.has(cat.codigo)) return true;
  if (CODIGOS_AYUDANTE.has(cod)) return true;

  const n = norm([opts.cargo, cat?.nombre, opts.codigoGoE].filter(Boolean).join(' '));
  if (!n) return false;
  if (n.includes('vigilante')) return false;
  if (n.includes('ayudante')) return true;
  if (n.includes('obrero de 1')) return true;
  if (n.includes('auxiliar de deposito')) return true;
  if (n.includes('rastriller') || n.includes('espesor') || n.includes('palero asfalt')) return true;
  return false;
}

export function trackEvaluacionObrero(opts: {
  cargo?: string | null;
  rolExamen?: string | null;
  codigoGoE?: string | null;
}): TrackEvaluacionObrero {
  return esAyudanteTabulador(opts) ? 'ayudante' : 'clasificado';
}

/**
 * Infiere familia desde `rol_buscado` / cargo / código GOE y, si aplica, `rol_examen`.
 */
export function familiaOficioDesdeCargo(opts: {
  cargo?: string | null;
  rolExamen?: string | null;
  codigoGoE?: string | null;
}): FamiliaOficioObrero {
  const rol = (opts.rolExamen ?? '').trim().toLowerCase();
  if (rol === 'vigilante') return 'vigilancia';
  if (esAyudanteTabulador(opts)) return 'ayudante';

  const cat = cargoPorCodigo(codigoGoENormalizado(opts.codigoGoE));
  const raw = [opts.cargo, cat?.nombre, opts.codigoGoE].filter(Boolean).join(' ');
  const n = norm(raw);
  if (!n) return 'general';

  if (
    n.includes('vigilante') ||
    n.includes('seguridad') ||
    n.includes('portero') ||
    n === '1.2' ||
    n.startsWith('1.2 ')
  ) {
    return 'vigilancia';
  }

  if (
    n.includes('electric') ||
    n.includes('electricomecan') ||
    n.includes('electro') ||
    /\b3\.6\b/.test(n) ||
    /\b5\.5\b/.test(n) ||
    /\b3\.21\b/.test(n)
  ) {
    return 'electricidad';
  }

  if (n.includes('plomer') || n.includes('fontaner') || /\b3\.5\b/.test(n) || /\b5\.4\b/.test(n)) {
    return 'plomeria';
  }

  if (
    n.includes('cabiller') ||
    n.includes('soldador') ||
    n.includes('carpinter') ||
    n.includes('encofr') ||
    n.includes('fierro') ||
    n.includes('armadur') ||
    /\b3\.3\b/.test(n) ||
    /\b3\.4\b/.test(n) ||
    /\b3\.19\b/.test(n) ||
    /\b4\.6\b/.test(n) ||
    /\b5\.2\b/.test(n) ||
    /\b5\.3\b/.test(n)
  ) {
    return 'estructuras';
  }

  if (
    n.includes('chofer') ||
    n.includes('operador') ||
    n.includes('maquinista') ||
    n.includes('mecanico') ||
    n.includes('engrasador') ||
    n.includes('cauchero') ||
    n.includes('latonero') ||
    n.includes('pala ') ||
    n.includes('paviment') ||
    n.includes('sandblast') ||
    n.includes('martillo perfor') ||
    n.includes('equipo')
  ) {
    return 'equipos';
  }

  if (
    n.includes('albanil') ||
    n.includes('albañil') ||
    n.includes('graniter') ||
    n.includes('pintor') ||
    n.includes('impermeabil') ||
    n.includes('obrero') ||
    n.includes('caporal') ||
    n.includes('ginchero') ||
    n.includes('rastriller') ||
    n.includes('espesor') ||
    n.includes('palero') ||
    n.includes('deposito') ||
    n.includes('depósito')
  ) {
    return 'obra_civil';
  }

  return 'general';
}
