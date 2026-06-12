export const PREFIJO_POR_VERIFICAR_PROCURA = '[POR VERIFICAR]';

export function sanitizarNumeroVenezolano(input: string): number {
  if (!input) return 0;
  let limpio = input.replace(/[Bs$\s]/g, '');
  if (limpio.includes('.') && limpio.includes(',')) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else if (limpio.includes(',') && !limpio.includes('.')) {
    limpio = limpio.replace(',', '.');
  } else if (limpio.includes('.') && !limpio.includes(',')) {
    const partes = limpio.split('.');
    if (partes[partes.length - 1].length === 3) {
      limpio = limpio.replace(/\./g, '');
    }
  }
  const resultado = parseFloat(limpio);
  return isNaN(resultado) ? 0 : resultado;
}

export function limpiarDescripcionProcura(descripcion: string): string {
  return descripcion
    .replace(new RegExp(`^${PREFIJO_POR_VERIFICAR_PROCURA}\\s*`, 'i'), '')
    .trim();
}
