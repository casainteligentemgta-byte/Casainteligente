import { CCO_TIPOS_GASTO, type CcoTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';

const ALIAS: Record<string, CcoTipoGasto> = {
  'ADMINISTRACION DELEGADA': 'ADMINISTRACIÓN DELEGADA',
  'ADMINISTRACIÓN DELEGADA': 'ADMINISTRACIÓN DELEGADA',
  ADMIN: 'ADMINISTRACIÓN DELEGADA',
  MATERIALES: 'MATERIALES',
  CONTRATISTA: 'CONTRATISTA',
  CONTRATO: 'CONTRATISTA',
  EQUIPOS: 'EQUIPOS',
  INSUMOS: 'INSUMOS',
  'MANO DE OBRA': 'MANO DE OBRA',
  TRANSPORTE: 'TRANSPORTE',
  PERMISOLOGIA: 'PERMISOLOGIA',
  PERMISOLOGÍA: 'PERMISOLOGIA',
  PROYECTO: 'PROYECTO',
};

/** Normaliza nombre de tipo V4 → enum CCO CI. Devuelve null si es tipo de auditoría/sesión. */
export function normalizarTipoGastoCco(raw: string | null | undefined): CcoTipoGasto | null {
  const u = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  if (!u) return null;
  if (ALIAS[u]) return ALIAS[u];
  const hit = CCO_TIPOS_GASTO.find(
    (t) =>
      t
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase() === u,
  );
  return hit ?? null;
}

export function esTipoGastoOperativo(raw: string | null | undefined): boolean {
  return normalizarTipoGastoCco(raw) != null;
}
