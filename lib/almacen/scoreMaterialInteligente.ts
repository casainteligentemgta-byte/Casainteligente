import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import {
  normalizarTextoMaterial,
  variantesObraMaterial,
} from '@/lib/almacen/normalizarTextoMaterial';

export function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

export function ratioSimilitudLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  return ((maxLen - distanciaLevenshtein(a, b)) / maxLen) * 100;
}

function palabrasMaterial(nameNorm: string): string[] {
  return nameNorm.split(/\s+/).filter((w) => w.length >= 2);
}

/** Evita falsos positivos tipo «arena»↔«al» o «cabilla»↔«c» en nombres SAP ruidosos. */
const MIN_CHARS_PREFIJO_PALABRA = 3;

function coincidePrefijoPalabra(term: string, word: string): boolean {
  if (word.length >= MIN_CHARS_PREFIJO_PALABRA && term.startsWith(word)) return true;
  if (term.length >= MIN_CHARS_PREFIJO_PALABRA && word.startsWith(term)) return true;
  return false;
}

function palabrasSignificativas(words: string[]): string[] {
  return words.filter((w) => w.length >= MIN_CHARS_PREFIJO_PALABRA);
}

function mejorSimilitudPalabras(term: string, words: string[]): number {
  if (!words.length) return 0;
  let best = ratioSimilitudLevenshtein(term, words.join(' '));
  for (const w of palabrasSignificativas(words)) {
    best = Math.max(best, ratioSimilitudLevenshtein(term, w));
  }
  return best;
}

/**
 * Puntúa coincidencia 0–100 entre término buscado y material de catálogo.
 * Combina match exacto, prefijos, subcadenas y Levenshtein con variantes de obra.
 */
export function scoreMaterialInteligente(
  termNorm: string,
  material: MaterialCampoOpcion,
): number {
  const t = termNorm.trim();
  if (!t) return 0;

  const nameNorm = normalizarTextoMaterial(material.name);
  const codeNorm = normalizarTextoMaterial(material.sap_code ?? '');
  const words = palabrasMaterial(nameNorm);

  if (nameNorm === t || codeNorm === t) return 100;
  if (words.some((w) => w === t)) return 97;
  if (nameNorm.startsWith(t) || codeNorm.startsWith(t)) return 90;
  if (words.some((w) => coincidePrefijoPalabra(t, w))) return 88;
  if (nameNorm.includes(t) || codeNorm.includes(t)) return 78;

  let best = Math.max(
    mejorSimilitudPalabras(t, words),
    ratioSimilitudLevenshtein(t, nameNorm),
  );

  for (const variant of variantesObraMaterial(t)) {
    if (nameNorm === variant || words.some((w) => w === variant)) return 95;
    if (words.some((w) => coincidePrefijoPalabra(variant, w))) return 90;
    best = Math.max(best, mejorSimilitudPalabras(variant, words));
  }

  return best >= 62 ? Math.round(best) : 0;
}
