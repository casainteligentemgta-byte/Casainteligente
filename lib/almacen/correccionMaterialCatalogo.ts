import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import {
  buscarMaterialesInteligenteCatalogo,
  type BuscarMaterialesCatalogoOpts,
} from '@/lib/almacen/buscarMaterialesCatalogo';
import { normalizarTextoMaterial, variantesObraMaterial } from '@/lib/almacen/normalizarTextoMaterial';
import { ratioSimilitudLevenshtein } from '@/lib/almacen/scoreMaterialInteligente';

/** Score mínimo del buscador para considerar corrección ortográfica. */
export const SCORE_MIN_CORRECCION_MATERIAL = 82;

/** Similitud mínima entre el término y la mejor palabra del nombre canónico. */
export const SIMILITUD_MIN_TYPO_MATERIAL = 72;

export type EvaluacionCoincidenciaMaterial = {
  coincideExacto: boolean;
  esTypo: boolean;
  similitudPalabra: number;
};

export type CorreccionMaterialCatalogo = {
  termino: string;
  terminoNorm: string;
  candidato: MaterialCampoOpcion;
  score: number;
  coincideExacto: boolean;
  esTypo: boolean;
  similitudPalabra: number;
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

/** Mejor candidato canónico si el texto parece un error ortográfico (ej. cabiya → CABILLA). */
export async function buscarCorreccionMaterialCatalogo(
  supabase: SupabaseClient,
  term: string,
  opts?: BuscarMaterialesCatalogoOpts,
): Promise<CorreccionMaterialCatalogo | null> {
  const t = term.trim();
  if (t.length < 3) return null;

  const resultados = await buscarMaterialesInteligenteCatalogo(supabase, t, {
    ...opts,
    limit: opts?.limit ?? 8,
  });

  const top = resultados[0];
  if (!top) return null;

  const evaluacion = evaluarCoincidenciaMaterial(t, top.material, top.score);
  if (!evaluacion.esTypo && !evaluacion.coincideExacto) return null;
  if (evaluacion.coincideExacto) return null;

  return {
    termino: t,
    terminoNorm: normalizarTextoMaterial(t),
    candidato: top.material,
    score: top.score,
    coincideExacto: false,
    esTypo: true,
    similitudPalabra: evaluacion.similitudPalabra,
  };
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
