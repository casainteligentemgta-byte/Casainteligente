/** Clave estable para cruzar partidas entre MDB, BD y APU. */
export function normalizarCodigoPartidaKey(codigo: string): string {
  return codigo
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\w.-]/g, '');
}
