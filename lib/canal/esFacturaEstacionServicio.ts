import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';

/**
 * Regla de Luis (Director): las facturas de estación de servicio / bomba que llegan
 * por el canal Telegram deben entrar solas a compras, sin pulsar Confirmar.
 *
 * Señales (cualquiera basta), sobre texto normalizado (sin tildes, mayúsculas):
 *  1) Razón social: «estación de servicio», «gasolinera», token «EDS».
 *  2) Líneas de combustible (GASOLINA / DIESEL / GASOIL / GASOLEO) y ninguna
 *     línea que no sea combustible — así no se cuela una ferretería con un
 *     «filtro diesel» suelto.
 *
 * PDVSA sola no cuenta: emite otros documentos. PDVSA + líneas de combustible sí.
 */
const TOKENS_PROVEEDOR_EDS = new Set(['EDS']);

const RE_PROVEEDOR_EDS = [
  /\bESTACION DE SERVICIO\b/,
  /\bESTACION SERVICIO\b/,
  /\bGASOLINERA\b/,
  /\bBOMBA DE GASOLINA\b/,
  /\bESTACION PDVSA\b/,
  /\bPDVSA ESTACION\b/,
];

const RE_LINEA_COMBUSTIBLE =
  /\b(GASOLINA|DIESEL|GASOIL|GASOLEO|GASOHOL)\b/;

const RE_LINEA_NO_COMBUSTIBLE =
  /\b(FILTRO|ACEITE|MANGUERA|BOMBA HIDRAULICA|LUBRICANTE|ADITIVO)\b/;

export function normalizarTextoEstacionServicio(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function tokens(texto: string): string[] {
  return texto.split(' ').filter(Boolean);
}

export function proveedorEsEstacionServicio(supplierName: unknown): boolean {
  const n = normalizarTextoEstacionServicio(supplierName);
  if (!n) return false;
  if (RE_PROVEEDOR_EDS.some((re) => re.test(n))) return true;
  return tokens(n).some((t) => TOKENS_PROVEEDOR_EDS.has(t));
}

export function descripcionEsCombustible(description: unknown): boolean {
  const n = normalizarTextoEstacionServicio(description);
  if (!n) return false;
  if (RE_LINEA_NO_COMBUSTIBLE.test(n)) return false;
  return RE_LINEA_COMBUSTIBLE.test(n);
}

function lineasConDescripcion(
  extracted: Pick<ExtractedCanalHeader, 'items'> | null | undefined,
): string[] {
  return (extracted?.items ?? [])
    .map((it) => String(it.description ?? '').trim())
    .filter(Boolean);
}

/** Todas las líneas con descripción son combustible y hay al menos una. */
export function lineasSonSoloCombustible(
  extracted: Pick<ExtractedCanalHeader, 'items'> | null | undefined,
): boolean {
  const descs = lineasConDescripcion(extracted);
  if (!descs.length) return false;
  return descs.every(descripcionEsCombustible);
}

export function esFacturaEstacionServicio(
  extracted: Pick<ExtractedCanalHeader, 'supplier_name' | 'items'> | null | undefined,
): boolean {
  if (!extracted) return false;
  if (proveedorEsEstacionServicio(extracted.supplier_name)) return true;
  return lineasSonSoloCombustible(extracted);
}
