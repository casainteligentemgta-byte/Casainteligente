/**
 * Destino del enlace «Lista de contratos express» en /talento y RRHH.
 * Ruta interna por defecto; opcional `NEXT_PUBLIC_TALENTO_EXPRESS_LIST_URL` (URL completa).
 */
export function hrefListaContratosExpress(): string {
  const custom = process.env.NEXT_PUBLIC_TALENTO_EXPRESS_LIST_URL?.trim();
  if (custom) return custom.replace(/\/$/, '');
  return '/rrhh';
}
