/**
 * Destino del enlace «Contrato de trabajo (obrero)» en /talento y RRHH
 * (antes «contratos express»).
 * Ruta interna por defecto; opcional `NEXT_PUBLIC_TALENTO_EXPRESS_LIST_URL` (URL completa).
 */
export function hrefListaContratosExpress(opts?: {
  proyectoModuloId?: string | null;
}): string {
  const custom = process.env.NEXT_PUBLIC_TALENTO_EXPRESS_LIST_URL?.trim();
  if (custom) return custom.replace(/\/$/, '');
  const pid = (opts?.proyectoModuloId ?? '').trim();
  if (pid) {
    return `/rrhh/contrato-trabajo-obrero?proyecto=${encodeURIComponent(pid)}`;
  }
  return '/rrhh/contrato-trabajo-obrero';
}
