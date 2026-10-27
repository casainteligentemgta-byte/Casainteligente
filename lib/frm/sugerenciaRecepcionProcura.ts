import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';
import { ratioSimilitudLevenshtein } from '@/lib/almacen/scoreMaterialInteligente';

/** Compra de Procura (borrador) contra la que se sugiere una recepción de campo. */
export type CompraParaSugerencia = {
  ubicacionId: string;
  proveedorRif: string | null;
  proveedorNombre: string | null;
  materiales: string[];
};

/** Recepción de campo registrada candidata. */
export type RecepcionParaSugerencia = {
  id: string;
  ubicacionId: string;
  proveedorRif: string | null;
  proveedorNombre: string | null;
  materiales: string[];
};

export type SugerenciaRecepcion = {
  recepcionId: string;
  puntaje: number;
  motivos: string[];
};

function normRif(v: string | null | undefined): string {
  return String(v ?? '').toUpperCase().replace(/[\s.-]/g, '');
}

function normNombre(v: string | null | undefined): string {
  return normalizarTextoMaterial(String(v ?? '')).trim();
}

/** Palabras significativas (3+ letras) de un material ya normalizado. */
function palabrasSignificativas(texto: string): string[] {
  return normalizarTextoMaterial(texto)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

/** Cobertura 0–1: qué parte de las palabras de `a` aparece (exacta o casi exacta) en `b`. */
function coberturaPalabras(a: string, b: string): number {
  const pa = palabrasSignificativas(a);
  const pb = palabrasSignificativas(b);
  if (!pa.length || !pb.length) return 0;
  const cubiertas = pa.filter((x) => pb.some((y) => x === y || ratioSimilitudLevenshtein(x, y) / 100 >= 0.8));
  return cubiertas.length / pa.length;
}

/**
 * Similitud 0–1 entre dos listas de materiales: para cada material de la compra,
 * la mejor cobertura de palabras con los de la recepción; se promedia.
 * Compara palabras, no caracteres, para no confundir materiales distintos.
 */
export function similitudMateriales(compra: string[], recepcion: string[]): number {
  const a = compra.filter((x) => normalizarTextoMaterial(x).trim() !== '');
  const b = recepcion.filter((x) => normalizarTextoMaterial(x).trim() !== '');
  if (!a.length || !b.length) return 0;
  const mejores = a.map((x) => Math.max(...b.map((y) => coberturaPalabras(x, y))));
  return mejores.reduce((s, v) => s + v, 0) / mejores.length;
}

/**
 * Puntúa una recepción como candidata para la compra de Procura.
 * Ubicación y proveedor son obligatorios: si no coinciden, no hay sugerencia (null).
 * Materiales aportan hasta 100 puntos.
 */
export function puntuarSugerenciaRecepcion(
  compra: CompraParaSugerencia,
  recepcion: RecepcionParaSugerencia,
): SugerenciaRecepcion | null {
  if (compra.ubicacionId !== recepcion.ubicacionId) return null;

  const rifCompra = normRif(compra.proveedorRif);
  const rifRecepcion = normRif(recepcion.proveedorRif);
  const proveedorOk =
    (rifCompra.length >= 4 && rifCompra === rifRecepcion) ||
    (normNombre(compra.proveedorNombre) !== '' &&
      normNombre(compra.proveedorNombre) === normNombre(recepcion.proveedorNombre));
  if (!proveedorOk) return null;

  const similitud = similitudMateriales(compra.materiales, recepcion.materiales);
  const puntaje = Math.round(similitud * 100);
  const motivos = [
    'Misma ubicación',
    rifCompra.length >= 4 && rifCompra === rifRecepcion ? 'Mismo RIF' : 'Mismo nombre de proveedor',
    `Materiales ${puntaje}% similares`,
  ];

  return { recepcionId: recepcion.id, puntaje, motivos };
}

/** Ordena por puntaje descendente y limita la lista. */
export function ordenarSugerencias(
  compra: CompraParaSugerencia,
  recepciones: RecepcionParaSugerencia[],
  limite = 5,
): SugerenciaRecepcion[] {
  return recepciones
    .map((r) => puntuarSugerenciaRecepcion(compra, r))
    .filter((s): s is SugerenciaRecepcion => s !== null)
    .sort((x, y) => y.puntaje - x.puntaje)
    .slice(0, limite);
}
