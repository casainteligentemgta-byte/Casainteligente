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
  let s = descripcion.trim();
  const prefijo = PREFIJO_POR_VERIFICAR_PROCURA;
  if (s.length >= prefijo.length && s.slice(0, prefijo.length).toUpperCase() === prefijo.toUpperCase()) {
    s = s.slice(prefijo.length).trimStart();
  }
  return s;
}

/** Nombre visible en confirmaciones (sin prefijo, «por verificar» ni código SAP). */
export function nombreMaterialProcuraVisible(materialTxt: string): string {
  let limpio = limpiarDescripcionProcura(materialTxt);
  limpio = limpio.replace(/\s*\(\s*por\s+verificar\s*\)\s*$/i, '').trim();
  const sinSku = limpio.replace(/\s*\([^)]+\)\s*$/, '').trim();
  return sinSku || limpio || 'Material';
}
