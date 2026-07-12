/**
 * Planilla Anexo I (referencia Gaceta) — 2 páginas, fondo blanco y texto oscuro.
 * Página 1: secciones I–III (identificación, contratación/certificaciones, instrucción).
 * Página 2: IV–VIII + declaración y bloque de firma/huella (vacío si no se pasa firma en meta).
 *
 * Implementación: reutiliza el documento legal ya homologado en `hojaVidaPdfLegal.tsx`.
 */
export { HojaDeVidaObreroLegalPdfDoc as PlanillaAnexo1PdfDocument } from '@/lib/talento/hojaVidaPdfLegal';
export type { HojaVidaLegalPdfMeta as PlanillaAnexo1PdfMeta } from '@/lib/talento/hojaVidaPdfLegal';
