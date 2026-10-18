/**
 * Medidas en fracción dentro del nombre de un material («cabilla 1/2», «ángulo 1 1/2"»).
 *
 * Para buscar, «1/2» y «1 1/2» son medidas distintas: se convierten en un solo token cada
 * una («1de2» y «1y1de2») antes de partir el texto en palabras.
 */

/** «1 1/2» → «1y1de2», «3/8» → «3de8». El resto del texto no cambia. */
export function normalizarMedidas(texto: string): string {
  return texto
    .replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, '$1y$2de$3')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1de$2');
}

/** Fracciones que nombra el texto, ya normalizadas. */
export function medidasDe(texto: string): Set<string> {
  return new Set(normalizarMedidas(texto).match(/\d+(?:y\d+)?de\d+/g) ?? []);
}

/**
 * ¿El material sirve para lo buscado, por medida? Si la búsqueda trae una fracción y el
 * nombre del material trae otras (y no esa), no es lo que se pidió: «cabilla 1/2» no es
 * «CABILLAS 3/8». Un nombre sin fracción no se descarta.
 */
export function medidaCompatible(busqueda: string, nombre: string): boolean {
  const pedidas = medidasDe(busqueda);
  if (!pedidas.size) return true;
  const tiene = medidasDe(nombre);
  if (!tiene.size) return true;
  return Array.from(pedidas).every((m) => tiene.has(m));
}
