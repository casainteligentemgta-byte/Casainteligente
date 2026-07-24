export type MaterialCatalogRow = {
  id: string;
  name?: string | null;
  sap_code?: string | null;
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Intenta vincular la descripción extraída con un material del inventario global. */
export function matchProcurementMaterialId(
  description: string,
  materials: MaterialCatalogRow[]
): string | null {
  const target = norm(description);
  if (!target || materials.length === 0) return null;

  const byExact = materials.find((m) => norm(m.name || '') === target);
  if (byExact) return byExact.id;

  const byCode = materials.find((m) => {
    const code = m.sap_code?.trim();
    return code && (target.includes(norm(code)) || norm(code).includes(target));
  });
  if (byCode) return byCode.id;

  let best: { id: string; score: number } | null = null;
  for (const m of materials) {
    const name = norm(m.name || '');
    if (!name) continue;
    if (name.includes(target) || target.includes(name)) {
      const score = Math.min(name.length, target.length) / Math.max(name.length, target.length);
      if (!best || score > best.score) best = { id: m.id, score };
    }
  }
  return best?.id ?? null;
}
