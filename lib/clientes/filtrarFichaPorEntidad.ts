import type { FiltroEntidadFicha } from '@/lib/clientes/clienteEntidades';
import { esUuid } from '@/lib/clientes/entidadActiva';

export type ObraParaFiltroEntidad = {
  id: string;
  entidadId?: string | null;
  budgetId?: string | null;
  budgetsAdicionales?: unknown;
};

function idsDeAdicionales(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? '').trim()).filter((id) => esUuid(id));
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return idsDeAdicionales(JSON.parse(raw));
    } catch {
      return esUuid(raw.trim()) ? [raw.trim()] : [];
    }
  }
  return [];
}

/** Admin (filtro nulo) ve todo. Obra sin empresa: solo el admin. */
export function pasaFiltroEntidad(
  entidadId: string | null | undefined,
  filtro: FiltroEntidadFicha | null | undefined,
): boolean {
  if (!filtro || filtro.entidadIds == null) return true;
  const id = String(entidadId ?? '').trim();
  if (!esUuid(id)) return false;
  return filtro.entidadIds.includes(id);
}

export function filtrarObrasPorEntidad<T extends { entidadId?: string | null }>(
  obras: T[],
  filtro: FiltroEntidadFicha | null | undefined,
): T[] {
  if (!filtro || filtro.entidadIds == null) return obras;
  return obras.filter((o) => pasaFiltroEntidad(o.entidadId, filtro));
}

function obrasQueReferencianPresupuesto(
  budgetId: string,
  obras: ObraParaFiltroEntidad[],
): ObraParaFiltroEntidad[] {
  const bid = budgetId.trim();
  if (!bid) return [];
  return obras.filter((o) => {
    if (String(o.budgetId ?? '').trim() === bid) return true;
    return idsDeAdicionales(o.budgetsAdicionales).includes(bid);
  });
}

/**
 * Presupuesto ligado a una obra: solo si esa obra es de una empresa del usuario.
 * Presupuesto sin obra: se muestra a quien ya ve al cliente (no hay entidad en budgets).
 */
export function presupuestoPasaFiltroEntidad(
  budgetId: string,
  obras: ObraParaFiltroEntidad[],
  filtro: FiltroEntidadFicha | null | undefined,
): boolean {
  if (!filtro || filtro.entidadIds == null) return true;
  const vinculadas = obrasQueReferencianPresupuesto(budgetId, obras);
  if (vinculadas.length === 0) return true;
  return vinculadas.some((o) => pasaFiltroEntidad(o.entidadId, filtro));
}

export function filtrarPresupuestosPorEntidad<T extends { id: string }>(
  presupuestos: T[],
  obras: ObraParaFiltroEntidad[],
  filtro: FiltroEntidadFicha | null | undefined,
): T[] {
  if (!filtro || filtro.entidadIds == null) return presupuestos;
  return presupuestos.filter((p) => presupuestoPasaFiltroEntidad(p.id, obras, filtro));
}

export function idsObrasVisibles(
  obras: Array<{ id: string; entidadId?: string | null }>,
  filtro: FiltroEntidadFicha | null | undefined,
): Set<string> {
  return new Set(filtrarObrasPorEntidad(obras, filtro).map((o) => o.id));
}
