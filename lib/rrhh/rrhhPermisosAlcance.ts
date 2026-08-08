/**
 * Alcances RRHH permitidos según permisos efectivos del actor.
 * Sin enforcement o sin datos → ambos (compatibilidad).
 */

import type { RrhhAlcanceMode } from '@/lib/rrhh/rrhhAlcance';

export type RrhhPermisosAlcance = {
  entidad: boolean;
  obra: boolean;
  /** Ambos o enforcement relajado. */
  ambos: boolean;
};

export function resolverPermisosAlcanceRrhh(opts: {
  permisos: string[] | Set<string>;
  enforcement?: boolean;
}): RrhhPermisosAlcance {
  const set = opts.permisos instanceof Set ? opts.permisos : new Set(opts.permisos);
  const enforcement = Boolean(opts.enforcement);

  const entidad = set.has('rrhh.entidad') || set.has('admin.config');
  const obra = set.has('rrhh.obra') || set.has('admin.config');

  // Compat: rol legacy solo con equipo.gestionar (antes de fase 3)
  const legacyRrhh = set.has('equipo.gestionar') && !entidad && !obra;

  if (!enforcement || legacyRrhh || (!entidad && !obra && set.size === 0)) {
    return { entidad: true, obra: true, ambos: true };
  }

  const e = entidad || legacyRrhh;
  const o = obra || legacyRrhh;
  return { entidad: e, obra: o, ambos: e && o };
}

export function modesPermitidos(p: RrhhPermisosAlcance): RrhhAlcanceMode[] {
  const out: RrhhAlcanceMode[] = [];
  if (p.entidad) out.push('entidad');
  if (p.obra) out.push('obra');
  return out.length ? out : (['obra', 'entidad'] as RrhhAlcanceMode[]);
}

export function modeInicialPermitido(
  preferido: RrhhAlcanceMode,
  p: RrhhPermisosAlcance,
): RrhhAlcanceMode {
  const allowed = modesPermitidos(p);
  if (allowed.includes(preferido)) return preferido;
  return allowed[0] ?? 'obra';
}
