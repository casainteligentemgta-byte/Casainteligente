import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import {
  buscarMaterialesInteligenteCatalogo,
  type BuscarMaterialesCatalogoOpts,
} from '@/lib/almacen/buscarMaterialesCatalogo';
import { normalizarTextoMaterial, variantesObraMaterial } from '@/lib/almacen/normalizarTextoMaterial';
import {
  ratioSimilitudLevenshtein,
  scoreMaterialInteligente,
} from '@/lib/almacen/scoreMaterialInteligente';

/** Score mínimo del buscador para considerar corrección ortográfica. */
export const SCORE_MIN_CORRECCION_MATERIAL = 82;

/** Similitud mínima entre el término y la mejor palabra del nombre canónico. */
export const SIMILITUD_MIN_TYPO_MATERIAL = 72;

/** Términos frecuentes en obra (Venezuela) para detectar typos aunque falten en catálogo. */
const TERMINOS_OBRA_FRECUENTES = [
  'cabilla',
  'varilla',
  'cemento',
  'arena',
  'clavo',
  'alambre',
  'bloque',
  'hierro',
  'tubo',
  'pintura',
  'yeso',
  'gravilla',
  'cal',
  'malla',
  'cloro',
  'disco',
  'broca',
  'tornillo',
  'pegamento',
  'formon',
] as const;

export type EvaluacionCoincidenciaMaterial = {
  coincideExacto: boolean;
  esTypo: boolean;
  similitudPalabra: number;
};

export type CorreccionMaterialCatalogo = {
  termino: string;
  terminoNorm: string;
  /** Material del catálogo cuando existe; null si solo hay sugerencia ortográfica. */
  candidato: MaterialCampoOpcion | null;
  terminoCanonico: string;
  score: number;
  coincideExacto: boolean;
  esTypo: boolean;
  similitudPalabra: number;
  /** true cuando el término corregido no está aún en global_inventory de la entidad. */
  soloOrtografia: boolean;
};

function palabrasSignificativas(nameNorm: string): string[] {
  return nameNorm.split(/\s+/).filter((w) => w.length >= 3);
}

function mejorSimilitudConPalabras(termNorm: string, nameNorm: string): number {
  const words = palabrasSignificativas(nameNorm);
  let best = ratioSimilitudLevenshtein(termNorm, nameNorm);
  for (const w of words) {
    best = Math.max(best, ratioSimilitudLevenshtein(termNorm, w));
  }
  for (const variant of variantesObraMaterial(termNorm)) {
    best = Math.max(best, ratioSimilitudLevenshtein(variant, nameNorm));
    for (const w of words) {
      best = Math.max(best, ratioSimilitudLevenshtein(variant, w));
    }
  }
  return best;
}

export function etiquetaTerminoCanonicoObra(term: string): string {
  const t = term.trim();
  if (!t) return t;
  if (t.length <= 8) return t.toUpperCase();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Evalúa si el término coincide exactamente o parece un typo del material. */
export function evaluarCoincidenciaMaterial(
  term: string,
  material: MaterialCampoOpcion,
  score: number,
): EvaluacionCoincidenciaMaterial {
  const termNorm = normalizarTextoMaterial(term);
  const nameNorm = normalizarTextoMaterial(material.name);
  const codeNorm = normalizarTextoMaterial(material.sap_code ?? '');

  const coincideExacto =
    termNorm.length > 0 &&
    (nameNorm === termNorm ||
      codeNorm === termNorm ||
      nameNorm.split(/\s+/).some((w) => w === termNorm) ||
      material.name.toLowerCase().includes(term.trim().toLowerCase()));

  const similitudPalabra = mejorSimilitudConPalabras(termNorm, nameNorm);

  const esTypo =
    !coincideExacto &&
    score >= SCORE_MIN_CORRECCION_MATERIAL &&
    similitudPalabra >= SIMILITUD_MIN_TYPO_MATERIAL &&
    termNorm.length >= 3;

  return { coincideExacto, esTypo, similitudPalabra };
}

function buscarTypoEnTerminosObra(term: string): { canonico: string; similitud: number; score: number } | null {
  const termNorm = normalizarTextoMaterial(term);
  if (termNorm.length < 3) return null;

  let best: { canonico: string; similitud: number; score: number } | null = null;
  for (const canon of TERMINOS_OBRA_FRECUENTES) {
    if (canon === termNorm) continue;
    const fake: MaterialCampoOpcion = {
      id: '',
      name: canon,
      sap_code: null,
      unit: 'UND',
    };
    const score = scoreMaterialInteligente(termNorm, fake);
    const ev = evaluarCoincidenciaMaterial(term, fake, score);
    if (!ev.esTypo) continue;
    if (!best || ev.similitudPalabra > best.similitud) {
      best = { canonico: canon, similitud: ev.similitudPalabra, score };
    }
  }
  return best;
}

function construirCorreccion(
  term: string,
  candidato: MaterialCampoOpcion | null,
  terminoCanonico: string,
  score: number,
  similitudPalabra: number,
  soloOrtografia: boolean,
): CorreccionMaterialCatalogo {
  return {
    termino: term,
    terminoNorm: normalizarTextoMaterial(term),
    candidato,
    terminoCanonico,
    score,
    coincideExacto: false,
    esTypo: true,
    similitudPalabra,
    soloOrtografia,
  };
}

/** Mejor candidato canónico si el texto parece un error ortográfico (ej. cabiya → CABILLA). */
export async function buscarCorreccionMaterialCatalogo(
  supabase: SupabaseClient,
  term: string,
  opts?: BuscarMaterialesCatalogoOpts,
): Promise<CorreccionMaterialCatalogo | null> {
  const t = term.trim();
  if (t.length < 3) return null;

  const buscarOpts: BuscarMaterialesCatalogoOpts = {
    ...opts,
    limit: opts?.limit ?? 8,
    forzarSimilitud: true,
  };

  const resultados = await buscarMaterialesInteligenteCatalogo(supabase, t, buscarOpts);
  const top = resultados[0];
  if (top) {
    const evaluacion = evaluarCoincidenciaMaterial(t, top.material, top.score);
    if (evaluacion.esTypo) {
      return construirCorreccion(
        t,
        top.material,
        top.material.name,
        top.score,
        evaluacion.similitudPalabra,
        false,
      );
    }
  }

  const typoObra = buscarTypoEnTerminosObra(t);
  if (!typoObra) return null;

  const canonLabel = etiquetaTerminoCanonicoObra(typoObra.canonico);
  const porCanon = await buscarMaterialesInteligenteCatalogo(supabase, typoObra.canonico, buscarOpts);
  const hit = porCanon[0];
  if (hit && hit.score >= 70) {
    const ev = evaluarCoincidenciaMaterial(t, hit.material, hit.score);
    if (!ev.coincideExacto) {
      return construirCorreccion(
        t,
        hit.material,
        hit.material.name,
        Math.max(hit.score, typoObra.score),
        Math.max(ev.similitudPalabra, typoObra.similitud),
        false,
      );
    }
  }

  return construirCorreccion(t, null, canonLabel, typoObra.score, typoObra.similitud, true);
}

/**
 * Resuelve material canónico por texto (alias, nombre fuzzy). Para evitar duplicados en compras/procura.
 * Devuelve null si no hay match suficientemente fuerte.
 */
export async function resolverMaterialCanonicoPorTexto(
  supabase: SupabaseClient,
  term: string,
  opts?: BuscarMaterialesCatalogoOpts & { scoreMinimo?: number },
): Promise<{ material: MaterialCampoOpcion; score: number; matchedBy: 'exacto' | 'typo' | 'alias' } | null> {
  const t = term.trim();
  if (t.length < 3) return null;

  const scoreMin = opts?.scoreMinimo ?? SCORE_MIN_CORRECCION_MATERIAL;
  const resultados = await buscarMaterialesInteligenteCatalogo(supabase, t, {
    ...opts,
    limit: 3,
    forzarSimilitud: true,
  });

  const top = resultados[0];
  if (!top || top.score < scoreMin) return null;

  const evaluacion = evaluarCoincidenciaMaterial(t, top.material, top.score);
  if (evaluacion.coincideExacto) {
    return { material: top.material, score: top.score, matchedBy: 'exacto' };
  }
  if (evaluacion.esTypo) {
    return { material: top.material, score: top.score, matchedBy: 'typo' };
  }
  if (top.fuente === 'alias' && top.score >= 95) {
    return { material: top.material, score: top.score, matchedBy: 'alias' };
  }

  return null;
}
