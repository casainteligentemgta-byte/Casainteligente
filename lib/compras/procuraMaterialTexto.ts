export const PREFIJO_POR_VERIFICAR_PROCURA = '[POR VERIFICAR]';

export function limpiarDescripcionProcura(descripcion: string): string {
  return descripcion
    .replace(new RegExp(`^${PREFIJO_POR_VERIFICAR_PROCURA}\\s*`, 'i'), '')
    .trim();
}
