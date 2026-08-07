import { normCedulaToken } from '@/lib/talento/cedulaAuth';

export const TIPO_CONTRATO_OBRERO_EXPRESS = 'obrero_express';
export const TIPO_CONTRATO_AD = 'administracion_delegada';

type ExpressLike = {
  id?: string | null;
  created_at?: string | null;
  obrero_nombre?: string | null;
  obrero_cedula?: string | null;
  tipo_contrato?: string | null;
};

/** True si la fila es Administración Delegada (no cuenta como obrero express). */
export function esContratoExpressAdministracionDelegada(row: ExpressLike): boolean {
  const tipo = String(row.tipo_contrato ?? '')
    .trim()
    .toLowerCase();
  if (tipo === TIPO_CONTRATO_AD) return true;
  if (tipo && tipo !== TIPO_CONTRATO_OBRERO_EXPRESS) return true;

  const ced = normCedulaToken(row.obrero_cedula ?? '');
  if (ced === 'AD') return true;

  const nom = String(row.obrero_nombre ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (nom.includes('administracion delegada')) return true;

  return false;
}

/** Solo filas de contrato de trabajo (obrero), excluye AD y otros tipos. */
export function esContratoExpressObrero(row: ExpressLike): boolean {
  if (esContratoExpressAdministracionDelegada(row)) return false;
  const ced = normCedulaToken(row.obrero_cedula ?? '');
  if (!ced) return false;
  return true;
}

/**
 * Deja un contrato por cédula (el más reciente por `created_at`).
 * Evita doble conteo cuando el mismo obrero se generó en dos obras del alcance.
 */
export function deduplicarContratosExpressPorCedula<T extends ExpressLike>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const ced = normCedulaToken(row.obrero_cedula ?? '');
    if (!ced) continue;
    const prev = best.get(ced);
    if (!prev) {
      best.set(ced, row);
      continue;
    }
    const tNew = Date.parse(String(row.created_at ?? '')) || 0;
    const tOld = Date.parse(String(prev.created_at ?? '')) || 0;
    if (tNew >= tOld) best.set(ced, row);
  }
  return Array.from(best.values()).sort((a, b) => {
    const ta = Date.parse(String(a.created_at ?? '')) || 0;
    const tb = Date.parse(String(b.created_at ?? '')) || 0;
    return tb - ta;
  });
}

/** Filtra AD y deduplica por cédula. */
export function normalizarListaContratosExpressObrero<T extends ExpressLike>(rows: T[]): T[] {
  return deduplicarContratosExpressPorCedula(rows.filter(esContratoExpressObrero));
}
