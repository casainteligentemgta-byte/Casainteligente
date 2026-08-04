/**
 * Familias de oficio para adecuar el bloque ABC del obrero.
 * No es un cuestionario por cada código GOE: se agrupa por riesgos/tareas similares.
 */

export const FAMILIAS_OFICIO_OBRERO = [
  'general',
  'obra_civil',
  'electricidad',
  'plomeria',
  'estructuras',
  'equipos',
  'vigilancia',
] as const;

export type FamiliaOficioObrero = (typeof FAMILIAS_OFICIO_OBRERO)[number];

export function esFamiliaOficioObrero(v: string): v is FamiliaOficioObrero {
  return (FAMILIAS_OFICIO_OBRERO as readonly string[]).includes(v);
}

export function etiquetaFamiliaOficio(familia: FamiliaOficioObrero): string {
  switch (familia) {
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

  const raw = [opts.cargo, opts.codigoGoE].filter(Boolean).join(' ');
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
    n.includes('ayudante') ||
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
