/**
 * Destino del botón Express / contrato de trabajo (obrero) en RRHH.
 * Siempre ruta interna de la app (tabla + nuevo + masiva).
 * Ignora `NEXT_PUBLIC_TALENTO_EXPRESS_LIST_URL` para no mandar a un listado legacy externo.
 */
export function hrefListaContratosExpress(opts?: {
  proyectoModuloId?: string | null;
}): string {
  const pid = (opts?.proyectoModuloId ?? '').trim();
  if (pid) {
    return `/rrhh/contrato-trabajo-obrero?proyecto=${encodeURIComponent(pid)}`;
  }
  return '/rrhh/contrato-trabajo-obrero';
}
