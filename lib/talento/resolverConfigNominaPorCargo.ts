/**
 * Resuelve un cargo de listado de obra (p. ej. AYUDANTE, CARPINTERO, TOPOGRAFO)
 * contra filas de `ci_config_nomina` (tabulador GOE / Convención Colectiva / Gaceta).
 *
 * Regla de grado:
 * - Si el listado trae grado (2da, 1era…) → se respeta.
 * - Si viene SIN nivel y en Gaceta ese oficio SÍ tiene 1era/2da/3era → se toma **de 1era**.
 * - Si en Gaceta el oficio no tiene nivel (Ayudante, Caporal…) → se deja como figura.
 */

export type ConfigNominaMatchRow = {
  id: string;
  cargo_nombre: string;
  nivel_salarial?: number | null;
};

export function normCargoKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae 1|2|3|4 si el label indica grado; null si no. */
export function gradoDesdeCargoLabel(raw: string | null | undefined): 1 | 2 | 3 | 4 | null {
  const n = normCargoKey(String(raw ?? ''));
  if (!n) return null;
  if (/\b(?:de\s+)?(?:1(?:era|ra|a|ª)|primera)\b/.test(n)) return 1;
  if (/\b(?:de\s+)?(?:2(?:da|a|ª)|segunda)\b/.test(n)) return 2;
  if (/\b(?:de\s+)?(?:3(?:era|ra|a|ª)|tercera)\b/.test(n)) return 3;
  if (/\b(?:de\s+)?(?:4(?:ta|a|ª)|cuarta)\b/.test(n)) return 4;
  return null;
}

export function cargoLabelEspecificaGrado(raw: string | null | undefined): boolean {
  return gradoDesdeCargoLabel(raw) != null;
}

export function gradoDesdeDenominacionTabulador(cargoNombre: string | null | undefined): 1 | 2 | 3 | 4 | null {
  return gradoDesdeCargoLabel(cargoNombre);
}

/**
 * Nombres del listado de personal / Excel → denominación a buscar en el tabulador.
 */
const ALIAS_LISTADO_A_BUSQUEDA: Record<string, string> = {
  carpintero: 'carpintero',
  albanil: 'albanil',
  obrero: 'obrero',
  cabillero: 'cabillero',
  plomero: 'plomero',
  electricista: 'electricista',
  pintor: 'pintor',
  soldador: 'soldador',
  granitero: 'granitero',
  impermeabilizador: 'impermeabilizador',
  operador: 'operador de equipo liviano',
  topografo: 'ayudante de topografo',
  utilitis: 'ayudante',
  utilities: 'ayudante',
  utility: 'ayudante',
  utilites: 'ayudante',
  utilitie: 'ayudante',
  utilitario: 'ayudante',
  utilitiesman: 'ayudante',
  'ingeniero supervisor': 'maestro de obra',
  'ing supervisor': 'maestro de obra',
  'ingeniero civil': 'maestro de obra',
  ingeniero: 'maestro de obra',
  supervisor: 'caporal',
  'supervisor de obra': 'maestro de obra',
  'maestro obra': 'maestro de obra',
  'maestro de obras': 'maestro de obra',
};

/**
 * Preferencia cuando el listado no trae grado.
 * Oficios con nivel en Gaceta: 1era primero.
 * Oficios sin nivel: la forma rasa (Ayudante, Caporal).
 */
const SINONIMOS_PREFERIDOS: Record<string, string[]> = {
  operador: ['operador de equipo liviano', 'operador de equipo', 'operador'],
  'operador de equipo liviano': ['operador de equipo liviano', 'operador de equipo', 'operador'],
  carpintero: ['carpintero de 1era', 'carpintero de 1ra', 'carpintero de 2da', 'carpintero'],
  albanil: ['albanil de 1era', 'albanil de 1ra', 'albanil de 2da', 'albanil'],
  obrero: ['obrero de 1era', 'obrero de 1ra', 'obrero'],
  cabillero: ['cabillero de 1era', 'cabillero de 1ra', 'cabillero de 2da', 'cabillero'],
  plomero: ['plomero de 1era', 'plomero de 1ra', 'plomero de 2da', 'plomero'],
  electricista: ['electricista de 1era', 'electricista de 1ra', 'electricista de 2da', 'electricista'],
  pintor: ['pintor de 1era', 'pintor de 1ra', 'pintor de 2da', 'pintor'],
  soldador: ['soldador de 1era', 'soldador de 1ra', 'soldador de 2da', 'soldador de 3ra', 'soldador'],
  granitero: ['granitero de 1era', 'granitero de 1ra', 'granitero de 2da', 'granitero'],
  impermeabilizador: [
    'impermeabilizador de 1era',
    'impermeabilizador de 1ra',
    'impermeabilizador de 2da',
    'impermeabilizador',
  ],
  ayudante: ['ayudante'],
  'ayudante de topografo': ['ayudante de topografo'],
  'maestro de obra': ['maestro de obra de 1ra', 'maestro de obra de 1era', 'maestro de obra de 2da', 'maestro de obra'],
  caporal: ['caporal'],
};

function filaCoincideConBase(base: string, cargoNombreNorm: string): boolean {
  if (!base || !cargoNombreNorm) return false;
  return (
    cargoNombreNorm === base ||
    cargoNombreNorm.startsWith(`${base} `) ||
    cargoNombreNorm.startsWith(`${base} de`)
  );
}

/**
 * True si en el tabulador hay variantes con grado (1era/2da/…) para ese oficio base.
 * Ej.: Carpintero sí; Ayudante no.
 */
export function oficioTieneGradosEnTabulador(
  cargoLabel: string,
  configs: ConfigNominaMatchRow[],
): boolean {
  const bases = expandLabelsParaBusqueda(cargoLabel)
    .map((l) => l.replace(/\s+de\s+(?:1(?:era|ra)|2(?:da)|3(?:era|ra)|4(?:ta))$/, ''))
    .filter(Boolean);
  for (const row of configs) {
    const N = normCargoKey(row.cargo_nombre);
    const g = gradoDesdeDenominacionTabulador(N);
    if (g == null) continue;
    for (const base of bases) {
      if (filaCoincideConBase(base, N)) return true;
    }
  }
  return false;
}

function expandLabelsParaBusqueda(cargoLabel: string): string[] {
  const raw = normCargoKey(cargoLabel);
  if (!raw) return [];
  const grado = gradoDesdeCargoLabel(raw);
  const out: string[] = [raw];
  const alias = ALIAS_LISTADO_A_BUSQUEDA[raw];
  if (alias) out.push(normCargoKey(alias));

  const parts = raw.split(' ');
  if (parts.length >= 2) {
    const two = `${parts[0]} ${parts[1]}`;
    const a2 = ALIAS_LISTADO_A_BUSQUEDA[two];
    if (a2) out.push(normCargoKey(a2));
  }
  if (!grado && parts[0] && parts[0].length >= 5) {
    const a0 = ALIAS_LISTADO_A_BUSQUEDA[parts[0]];
    if (a0) out.push(normCargoKey(a0));
  }

  if (grado != null && parts.length >= 2) {
    const baseOficio = parts.slice(0, -1).join(' ').replace(/\s+de$/, '').trim();
    if (baseOficio.length >= 4) {
      out.push(baseOficio);
      const aBase = ALIAS_LISTADO_A_BUSQUEDA[baseOficio];
      if (aBase) out.push(normCargoKey(aBase));
    }
  }

  // Sin grado y el oficio tiene niveles → también buscar «… de 1era/1ra»
  if (grado == null) {
    for (const base of [...out]) {
      if (gradoDesdeCargoLabel(base) != null) continue;
      out.push(`${base} de 1era`);
      out.push(`${base} de 1ra`);
    }
  }

  return Array.from(new Set(out));
}

function scoreMatch(
  labelNorm: string,
  row: ConfigNominaMatchRow,
  opts: {
    nivelPreferido: number | null;
    gradoPedido: 1 | 2 | 3 | 4 | null;
    /** Listado sin grado + oficio con 1era/2da en Gaceta → preferir 1era. */
    preferirPrimera: boolean;
  },
): number {
  const L = labelNorm;
  const N = normCargoKey(row.cargo_nombre);
  if (!L || !N) return -1;

  let score = 0;
  if (N === L) score = 100;
  else if (N.startsWith(`${L} `) || N.startsWith(`${L} de`)) score = 80;
  else if (new RegExp(`(^|\\s)${L.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(N)) score = 60;
  else if (N.includes(L) && L.length >= 5) score = 45;
  else if (L.includes(N) && N.length >= 5) score = 42;
  else return -1;

  const Lbase = L.replace(/\s+de\s+(?:1(?:era|ra)|2(?:da)|3(?:era|ra)|4(?:ta))$/, '');
  const prefs = SINONIMOS_PREFERIDOS[Lbase] ?? SINONIMOS_PREFERIDOS[L];
  if (prefs?.length && opts.gradoPedido == null) {
    const idx = prefs.findIndex((p) => {
      const P = normCargoKey(p);
      return N === P || N.startsWith(`${P} `) || N.startsWith(`${P}.`);
    });
    if (idx >= 0) score += 25 - idx * 2;
  }

  const gradoFila = gradoDesdeDenominacionTabulador(N);

  if (opts.gradoPedido != null) {
    if (gradoFila != null) {
      if (gradoFila === opts.gradoPedido) score += 40;
      else score -= 35;
    }
  } else if (opts.preferirPrimera) {
    // Listado sin nivel + oficio con grados en Gaceta → igual a 1era.
    if (gradoFila === 1) score += 30;
    else if (gradoFila === 2 || gradoFila === 3 || gradoFila === 4) score -= 15;
  }

  if (opts.nivelPreferido != null) {
    if (row.nivel_salarial != null && Number(row.nivel_salarial) === opts.nivelPreferido) {
      score += 8;
    }
  }

  // Ante empate: preferir nombres más cortos (Ayudante > Ayudante de Operadores),
  // salvo cuando estamos forzando 1era (entonces no premiar 2da por ser más corta).
  if (!opts.preferirPrimera) {
    if (!Lbase.includes(' ')) {
      score += Math.max(0, 12 - Math.min(12, N.length / 6));
    } else {
      score += Math.max(0, 6 - Math.min(6, Math.abs(N.length - Lbase.length) / 10));
    }
  } else if (!Lbase.includes(' ') && gradoFila == null) {
    score += Math.max(0, 8 - Math.min(8, N.length / 8));
  }
  return score;
}

/**
 * Devuelve el id de config_nomina que mejor encaja con el cargo del Excel.
 * Denominación resultante = la de Gaceta/tabulador.
 */
export function resolverConfigNominaPorCargo(
  cargoLabel: string,
  configs: ConfigNominaMatchRow[],
  opts?: { nivelGenerico?: number | null },
): { id: string; cargo_nombre: string; score: number } | null {
  const label = (cargoLabel ?? '').trim();
  if (!label || configs.length === 0) return null;

  const nivel =
    opts?.nivelGenerico != null && Number.isFinite(Number(opts.nivelGenerico))
      ? Math.round(Number(opts.nivelGenerico))
      : null;

  const gradoPedido = gradoDesdeCargoLabel(label);
  const preferirPrimera =
    gradoPedido == null && oficioTieneGradosEnTabulador(label, configs);
  const labels = expandLabelsParaBusqueda(label);
  let best: { id: string; cargo_nombre: string; score: number } | null = null;

  for (const L of labels) {
    for (const row of configs) {
      const score = scoreMatch(L, row, {
        nivelPreferido: nivel,
        gradoPedido,
        preferirPrimera,
      });
      if (score < 40) continue;
      if (!best || score > best.score) {
        best = { id: row.id, cargo_nombre: row.cargo_nombre, score };
      }
    }
  }
  return best;
}

/** Quita sufijo de grado (uso auxiliar; el PDF usa la denominación Gaceta). */
export function oficioRasoParaContrato(cargoLabel: string | null | undefined): string | null {
  const raw = String(cargoLabel ?? '').trim().replace(/\s+/g, ' ');
  if (raw.length < 2) return null;
  const sinGrado = raw
    .replace(
      /\s+de\s+(?:1(?:era|ra|a|ª)|2(?:da|a|ª)|3(?:era|ra|a|ª)|4(?:ta|a|ª)|primera|segunda|tercera|cuarta)\.?\s*$/i,
      '',
    )
    .trim();
  return (sinGrado.length >= 2 ? sinGrado : raw).toUpperCase();
}
