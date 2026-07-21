import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';

/**
 * Clave estable para agrupar líneas de compra en «Lo comprado».
 * - Con material_id → un SKU canónico.
 * - Sin material_id → descripción normalizada + unificación fonética obra (k/c, b/v, y/ll)
 *   para que «kabilla» y «cabilla» sumen juntas.
 */
export function claveDescripcionLoComprado(descripcion: string): string {
  let n = normalizarTextoMaterial(descripcion);
  if (!n) return '';
  // Forma canónica: preferir c/b/ll sobre k/v/y
  n = n.replace(/k/g, 'c').replace(/v/g, 'b').replace(/y/g, 'll');
  return n;
}

export function claveAgrupacionLoComprado(input: {
  materialId?: string | null;
  descripcion?: string | null;
  proyectoId?: string | null;
}): string | null {
  const mid = input.materialId?.trim();
  const descKey = claveDescripcionLoComprado(String(input.descripcion ?? ''));
  if (!mid && !descKey) return null;

  const obra = input.proyectoId?.trim() || 'sin_proyecto';
  const art = mid ? `m:${mid}` : `d:${descKey}`;
  return `${obra}|${art}`;
}

/** Elige el mejor nombre visible entre variantes vistas (más frecuente, luego más largo). */
export function elegirDescripcionCanonica(
  variantes: Map<string, number>,
  fallback: string,
): string {
  if (!variantes.size) return fallback.trim() || 'Sin descripción';
  let best = fallback.trim() || 'Sin descripción';
  let bestCount = -1;
  let bestLen = -1;
  Array.from(variantes.entries()).forEach(([texto, count]) => {
    const t = texto.trim();
    if (!t) return;
    if (count > bestCount || (count === bestCount && t.length > bestLen)) {
      best = t;
      bestCount = count;
      bestLen = t.length;
    }
  });
  return best;
}
