import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarTrayectoriaMaterial,
  trayectoriaAMovimientosJourney,
  type MovimientoJourney,
  type TrayectoriaMovimiento,
} from '@/lib/almacen/trazabilidadMaterial';

export type TrayectoriaMaterialDetalle = {
  movimientos: MovimientoJourney[];
  material?: { nombre: string; codigo: string | null };
};

type ApiTrayectoria = {
  error?: string;
  material?: { nombre: string; codigo: string | null } | null;
  trayectoria?: TrayectoriaMovimiento[];
};

/** Cliente: GET /api/almacen/trazabilidad → movimientos listos para MaterialJourneyTimeline. */
export async function fetchTrayectoriaDetalle(materialId: string): Promise<TrayectoriaMaterialDetalle> {
  const mid = materialId.trim();
  if (!mid) throw new Error('Falta el identificador del material.');

  const res = await fetch(`/api/almacen/trazabilidad?materialId=${encodeURIComponent(mid)}`, {
    cache: 'no-store',
  });
  const data = (await res.json()) as ApiTrayectoria;
  if (!res.ok) throw new Error(data.error || 'No se pudo cargar la trayectoria');

  return {
    movimientos: trayectoriaAMovimientosJourney(data.trayectoria ?? []),
    material: data.material ?? undefined,
  };
}

/** Alias corto: solo el arreglo de movimientos (ej. movimientos={trayectoria}). */
export async function fetchTrayectoria(materialId: string): Promise<MovimientoJourney[]> {
  const { movimientos } = await fetchTrayectoriaDetalle(materialId);
  return movimientos;
}

/** Servidor (RSC / route): Supabase directo, sin pasar por la API. */
export async function fetchTrayectoriaServer(
  supabase: SupabaseClient,
  materialId: string,
): Promise<TrayectoriaMaterialDetalle> {
  const { trayectoria, material } = await listarTrayectoriaMaterial(supabase, materialId);
  return {
    movimientos: trayectoriaAMovimientosJourney(trayectoria),
    material,
  };
}
