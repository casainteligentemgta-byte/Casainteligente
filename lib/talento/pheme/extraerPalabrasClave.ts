/** Quita tildes/diacríticos para alinear con triggers Pheme (ASCII). */
export function quitarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '');
}

const STOPWORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'y',
  'o',
  'en',
  'para',
  'por',
  'con',
  'a',
  'al',
  'the',
  'and',
]);

/**
 * Extrae palabras clave normalizadas desde texto libre (cargo, solicitud, chat).
 * Ej.: "técnico de CCTV" → ["tecnico", "cctv"]
 */
export function extraerPalabrasClave(texto: string): string[] {
  const raw = quitarAcentos((texto ?? '').toLowerCase());
  const tokens = raw
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Normaliza un arreglo ya detectado (p. ej. desde IA o el prototipo Python). */
export function normalizarPalabrasClave(palabras: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of palabras ?? []) {
    const n = quitarAcentos(String(p ?? '').toLowerCase()).trim();
    if (n.length < 2 || STOPWORDS.has(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
