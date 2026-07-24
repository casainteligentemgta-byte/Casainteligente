/**
 * Motor de sugerencia de cuadrilla (DISC + fase técnica + proximidad LOTTT art. 240).
 * Sin dependencias de React ni Supabase.
 */

export type FaseObra = 'fundaciones' | 'estructura' | 'instalaciones' | 'acabados';

export type PerfilDisc = 'Rojo' | 'Verde' | 'Azul' | 'Amarillo';

export type ObreroCandidato = {
  id: string;
  perfil_color?: string | null;
  puntuacion_logica?: number | null;
  direccion_habitacion?: string | null;
  ciudad_estado?: string | null;
};

const PERFILES: PerfilDisc[] = ['Rojo', 'Verde', 'Azul', 'Amarillo'];

export function normalizarPerfilDisc(raw: string | null | undefined): PerfilDisc | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const t = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (t === 'Rojo' || t === 'Verde' || t === 'Azul' || t === 'Amarillo') return t as PerfilDisc;
  const up = s.toLowerCase();
  if (up === 'rojo' || up === 'verde' || up === 'azul' || up === 'amarillo') {
    return (up.charAt(0).toUpperCase() + up.slice(1)) as PerfilDisc;
  }
  return null;
}

/** Metas de composición ideal (casco por color) para la fase. */
export function composicionIdealPorFase(fase: FaseObra): Record<PerfilDisc, number> {
  switch (fase) {
    case 'fundaciones':
      return { Rojo: 2, Verde: 2, Azul: 0, Amarillo: 0 };
    case 'estructura':
      return { Rojo: 1, Verde: 2, Azul: 1, Amarillo: 0 };
    case 'instalaciones':
      return { Rojo: 0, Verde: 1, Azul: 3, Amarillo: 0 };
    case 'acabados':
      return { Rojo: 0, Verde: 1, Azul: 2, Amarillo: 0 };
    default:
      return { Rojo: 0, Verde: 0, Azul: 0, Amarillo: 0 };
  }
}

/** Texto corto de negocio por fase (Lean Construction). */
export function descripcionFaseObra(fase: FaseObra): string {
  switch (fase) {
    case 'fundaciones':
      return 'Cimientos: empuje y resistencia (Rojos y Verdes en equilibrio).';
    case 'estructura':
      return 'Estructura: un Rojo lidera, Verdes sostienen ritmo y un Azul valida medidas.';
    case 'instalaciones':
      return 'Instalaciones técnicas: precisión y normativa (predominio Azul).';
    case 'acabados':
      return 'Acabados: minuciosidad; ratio 2 Azul : 1 Verde; se evitan Rojos por prisa.';
    default:
      return '';
  }
}

/** 0–1 según coincidencia de texto obra vs residencia (costo transporte, art. 240 LOTTT). */
export function scoreProximidadUbicacion(obraUbicacionTexto: string, c: ObreroCandidato): number {
  const stripDiac = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const ref = stripDiac((obraUbicacionTexto ?? '').toLowerCase());
  if (!ref.trim()) return 0.5;
  const blob = stripDiac(`${c.direccion_habitacion ?? ''} ${c.ciudad_estado ?? ''}`.toLowerCase());
  if (!blob.trim()) return 0;

  const tokens = ref
    .split(/[\s,.;:/\-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  const claves = ['margarita', 'porlamar', 'jorge coll', 'coll', 'sabaneta', 'la isleta', 'cumaná', 'cumana', 'nueva esparta'];
  let hits = 0;
  for (const t of tokens) {
    if (blob.includes(t)) hits += 1;
  }
  for (const k of claves) {
    if (ref.includes(k) && blob.includes(k)) hits += 2;
  }
  return Math.min(1, hits / Math.max(3, tokens.length * 0.5 + 1));
}

function scoreLogica(p: number | null | undefined): number {
  if (p == null || !Number.isFinite(Number(p))) return 0;
  return Math.max(0, Math.min(100, Number(p))) / 100;
}

function ordenarPoolParaFase(
  fase: FaseObra,
  pool: ObreroCandidato[],
  obraUbicacionTexto: string,
): ObreroCandidato[] {
  const ideal = composicionIdealPorFase(fase);
  return [...pool].sort((a, b) => {
    const pa = normalizarPerfilDisc(a.perfil_color);
    const pb = normalizarPerfilDisc(b.perfil_color);
    const pref = (p: PerfilDisc | null) => {
      if (!p) return 0;
      const w = ideal[p];
      if (fase === 'acabados' && p === 'Rojo') return -1000;
      return w * 10;
    };
    const fitB = pref(pb) + scoreProximidadUbicacion(obraUbicacionTexto, b) * 120 + scoreLogica(b.puntuacion_logica) * 40;
    const fitA = pref(pa) + scoreProximidadUbicacion(obraUbicacionTexto, a) * 120 + scoreLogica(a.puntuacion_logica) * 40;
    return fitB - fitA;
  });
}

/**
 * Selecciona una cuadrilla recomendada que se acerca a la composición ideal
 * y prioriza proximidad + puntuación lógica.
 */
export function getRecommendedCrew(
  fase_obra: FaseObra,
  pool_obreros: ObreroCandidato[],
  opts?: { obraUbicacionTexto?: string },
): {
  fase: FaseObra;
  composicionIdeal: Record<PerfilDisc, number>;
  seleccion: ObreroCandidato[];
  idsSeleccion: string[];
  explicacionBreve: string;
} {
  const obraUbicacionTexto = (opts?.obraUbicacionTexto ?? '').trim();
  const ideal = composicionIdealPorFase(fase_obra);
  const buckets: Record<PerfilDisc, ObreroCandidato[]> = {
    Rojo: [],
    Verde: [],
    Azul: [],
    Amarillo: [],
  };

  for (const c of pool_obreros) {
    const p = normalizarPerfilDisc(c.perfil_color);
    const k = p ?? 'Amarillo';
    buckets[k].push(c);
  }

  const byLocLogic = (a: ObreroCandidato, b: ObreroCandidato) => {
    const sb =
      scoreProximidadUbicacion(obraUbicacionTexto, b) * 1000 +
      scoreLogica(b.puntuacion_logica) * 100 +
      (b.id > a.id ? 1 : 0);
    const sa =
      scoreProximidadUbicacion(obraUbicacionTexto, a) * 1000 +
      scoreLogica(a.puntuacion_logica) * 100 +
      (a.id > b.id ? 1 : 0);
    return sb - sa;
  };
  for (const col of PERFILES) {
    buckets[col].sort(byLocLogic);
  }

  const seleccion: ObreroCandidato[] = [];
  const usados = new Set<string>();

  const tomar = (color: PerfilDisc, n: number) => {
    if (n <= 0) return;
    for (const c of buckets[color]) {
      if (n <= 0) break;
      if (usados.has(c.id)) continue;
      if (fase_obra === 'acabados' && color === 'Rojo') continue;
      seleccion.push(c);
      usados.add(c.id);
      n -= 1;
    }
  };

  if (fase_obra === 'fundaciones') {
    tomar('Rojo', ideal.Rojo);
    tomar('Verde', ideal.Verde);
  } else if (fase_obra === 'estructura') {
    tomar('Rojo', ideal.Rojo);
    tomar('Verde', ideal.Verde);
    tomar('Azul', ideal.Azul);
  } else if (fase_obra === 'instalaciones') {
    tomar('Azul', ideal.Azul);
    tomar('Verde', ideal.Verde);
  } else {
    tomar('Azul', ideal.Azul);
    tomar('Verde', ideal.Verde);
  }

  const ordenados = ordenarPoolParaFase(fase_obra, pool_obreros, obraUbicacionTexto);
  const totalIdeal = PERFILES.reduce((s, k) => s + ideal[k], 0);
  for (const c of ordenados) {
    if (seleccion.length >= totalIdeal) break;
    if (usados.has(c.id)) continue;
    const p = normalizarPerfilDisc(c.perfil_color);
    if (fase_obra === 'acabados' && p === 'Rojo') continue;
    seleccion.push(c);
    usados.add(c.id);
  }

  const explicacionBreve = descripcionFaseObra(fase_obra);

  return {
    fase: fase_obra,
    composicionIdeal: ideal,
    seleccion,
    idsSeleccion: seleccion.map((x) => x.id),
    explicacionBreve,
  };
}

export function textoSugerenciaCuadrilla(
  nombreObra: string,
  fase: FaseObra,
  ubicacionResumida: string,
): string {
  const u = (ubicacionResumida ?? '').trim() || 'la ubicación del proyecto';
  const n = (nombreObra ?? '').trim() || 'esta obra';
  switch (fase) {
    case 'acabados':
      return `Para los acabados en ${n} (${u}), recomendamos este balance para reducir reprocesos en revestimientos y terminaciones. Priorizamos perfiles Azul y cercanía residencial (menor costo de transporte, art. 240 LOTTT).`;
    case 'fundaciones':
      return `En la fase de fundaciones de ${n} (${u}), conviene alternar empuje (Rojo) y constancia física (Verde), priorizando quienes viven más cerca del frente.`;
    case 'estructura':
      return `Para estructura en ${n} (${u}), un capataz dominante (Rojo), base estable (Verdes) y control dimensional (Azul) optimizan ritmo y seguridad.`;
    case 'instalaciones':
      return `En instalaciones de ${n} (${u}), predominan perfiles Azul por precisión normativa; un Verde aporta continuidad en tareas repetitivas.`;
    default:
      return `Sugerencia de equipo para ${n}.`;
  }
}
