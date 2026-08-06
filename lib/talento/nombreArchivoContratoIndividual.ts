/**
 * Nombre de archivo del PDF de contrato individual de trabajo:
 * `{nomenclatura}-{PRIMER_NOMBRE}-{APELLIDO}.pdf`
 * Ej.: `2026-08-DIMA-ASFJG-0001-JUAN-PEREZ.pdf`
 */

/** Primer nombre + primer apellido (o heurística desde nombre completo). */
export function primerNombreYApellidoObrero(opts: {
  nombres?: string | null;
  apellidos?: string | null;
  nombreCompleto?: string | null;
}): string {
  const n = (opts.nombres ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? '';
  const a = (opts.apellidos ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? '';
  if (n && a) return `${n} ${a}`;

  const parts = (opts.nombreCompleto ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    // Heurística VE: primer nombre + primer apellido (penúltimo si hay ≥3 tokens).
    return `${parts[0]} ${parts[parts.length - 2]}`;
  }
  if (parts.length === 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] ?? 'Obrero';
}

/** Parte de nombre segura para archivo (ASCII, mayúsculas, guiones). */
export function slugParteNombreArchivo(texto: string): string {
  const s = String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, 48);
  return s || 'OBRERO';
}

/** Sanea la nomenclatura para usarla como prefijo de archivo. */
export function slugNomenclaturaArchivo(nomenclatura: string): string {
  const s = String(nomenclatura ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, 64);
  return s || 'CONTRATO';
}

/**
 * Nombre de descarga / hoja del PDF:
 * nomenclatura + primer nombre y apellido del obrero.
 */
export function nombreArchivoPdfContratoIndividual(
  nomenclatura: string,
  opts: {
    nombres?: string | null;
    apellidos?: string | null;
    nombreCompleto?: string | null;
  },
): string {
  const persona = slugParteNombreArchivo(primerNombreYApellidoObrero(opts));
  return `${slugNomenclaturaArchivo(nomenclatura)}-${persona}.pdf`;
}

/** Ruta en Storage para contrato express con nombre legible. */
export function storagePathPdfContratoExpress(expressId: string, filename: string): string {
  const id = expressId.trim();
  const leaf = filename.replace(/^.*[\\/]/, '').replace(/[\\/]/g, '_') || 'contrato.pdf';
  return `express/${id}/${leaf}`;
}
