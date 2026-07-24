import { CARGOS_OBREROS } from '@/lib/constants/cargosObreros';

const CODIGOS_OBRA = new Set(CARGOS_OBREROS.map((c) => c.codigo.trim()));

/** Mano de obra directa (tabulador convención colectiva) vs gasto administrativo de oficina. */
export function esCargoManoObraDirecta(cargoCodigo: string | null | undefined): boolean {
  const cod = (cargoCodigo ?? '').trim();
  if (!cod) return false;
  return CODIGOS_OBRA.has(cod);
}

export function esCargoGastoAdministrativo(cargoCodigo: string | null | undefined): boolean {
  const cod = (cargoCodigo ?? '').trim();
  if (!cod) return true;
  return !esCargoManoObraDirecta(cod);
}
