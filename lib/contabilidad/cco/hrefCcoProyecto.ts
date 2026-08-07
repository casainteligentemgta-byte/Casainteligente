/** Control Contable de Obra (CCO) filtrado por proyecto / obra. */
export function hrefCcoProyecto(proyectoId: string | null | undefined): string {
  const id = (proyectoId ?? '').trim();
  if (!id) return '/contabilidad/cco';
  return `/contabilidad/cco?proyecto=${encodeURIComponent(id)}`;
}
