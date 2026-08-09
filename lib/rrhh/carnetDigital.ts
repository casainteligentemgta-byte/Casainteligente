/**
 * Carnet digital del obrero (obra determinada).
 * Código estable + datos para tarjeta UI / PDF.
 */

export type DatosCarnetDigital = {
  empleadoId: string;
  codigo: string;
  nombre: string;
  cedula: string;
  oficio: string;
  obraNombre: string | null;
  entidadNombre: string | null;
  fotoUrl: string | null;
  emitidoAt: string;
  vigenteHasta: string | null;
  sangre: string | null;
  telefono: string | null;
};

function slugCodigo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 6);
}

/** Genera código tipo CI-ASFALT-A1B2 a partir de obra + cédula. */
export function generarCodigoCarnet(opts: {
  obraNombre?: string | null;
  cedula?: string | null;
  empleadoId: string;
}): string {
  const obra = slugCodigo(opts.obraNombre ?? '') || 'OBRA';
  const ced = (opts.cedula ?? '').replace(/\D/g, '').slice(-4);
  const idShort = opts.empleadoId.replace(/-/g, '').slice(0, 4).toUpperCase();
  const cola = ced || idShort || '0000';
  return `CI-${obra}-${cola}`;
}

export function etiquetaVigenciaCarnet(vigenteHasta: string | null | undefined): string {
  const v = (vigenteHasta ?? '').trim();
  if (!v) return 'Vigente mientras dure la obra';
  try {
    return `Vigente hasta ${new Date(v + 'T12:00:00').toLocaleDateString('es-VE')}`;
  } catch {
    return `Vigente hasta ${v}`;
  }
}
