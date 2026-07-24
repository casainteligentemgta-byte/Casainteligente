import type { StockEnUbicacionResumen } from '@/lib/almacen/inventarioFiltroUbicacion';

type StockFilaApi = {
  ubicacion_id: string;
  cantidad_disponible: number;
};

/** Ubicación donde aplicar ajuste de stock desde el cuadro de almacén. */
export async function resolverUbicacionAjusteStock(params: {
  materialId: string;
  stockUb?: StockEnUbicacionResumen;
  ubicacionIdsFiltro: string[];
}): Promise<string | null> {
  const materialId = params.materialId.trim();
  if (!materialId) return null;

  const idsFiltro = params.ubicacionIdsFiltro.filter(Boolean);
  const idsStock = params.stockUb?.ubicacion_ids?.filter(Boolean) ?? [];

  if (idsStock.length === 1) return idsStock[0]!;
  if (idsFiltro.length === 1) return idsFiltro[0]!;

  const candidatas = idsStock.length
    ? idsStock
    : idsFiltro.length
      ? idsFiltro
      : [];

  if (candidatas.length === 1) return candidatas[0]!;

  try {
    const res = await fetch(
      `/api/almacen/inventario/${encodeURIComponent(materialId)}/stock`,
      { cache: 'no-store' },
    );
    const data = (await res.json()) as { filas?: StockFilaApi[]; error?: string };
    if (!res.ok) return null;

    const filas = (data.filas ?? []).filter((f) => f.ubicacion_id?.trim());
    if (!filas.length) {
      return candidatas[0] ?? idsFiltro[0] ?? null;
    }

    const enScope = candidatas.length
      ? filas.filter((f) => candidatas.includes(f.ubicacion_id))
      : filas;

    if (enScope.length === 1) return enScope[0]!.ubicacion_id;

    if (enScope.length > 1) {
      const mayor = [...enScope].sort(
        (a, b) => (b.cantidad_disponible ?? 0) - (a.cantidad_disponible ?? 0),
      )[0];
      if (mayor) return mayor.ubicacion_id;
    }

    return filas[0]?.ubicacion_id ?? candidatas[0] ?? null;
  } catch {
    return candidatas[0] ?? idsFiltro[0] ?? null;
  }
}
