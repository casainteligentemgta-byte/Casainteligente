/** Normaliza texto de material para comparación (sin tildes, minúsculas). */
export function normalizarTextoMaterial(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Variantes fonéticas frecuentes en obra (Venezuela): k/c, b/v, y/ll. */
export function variantesObraMaterial(norm: string): string[] {
  const base = norm.trim();
  if (!base) return [];

  const out = new Set<string>([base]);

  const swaps: Array<(s: string) => string> = [
    (s) => s.replace(/k/g, 'c'),
    (s) => s.replace(/c/g, 'k'),
    (s) => s.replace(/v/g, 'b'),
    (s) => s.replace(/b/g, 'v'),
    (s) => s.replace(/y/g, 'll'),
    (s) => s.replace(/ll/g, 'y'),
    (s) => s.replace(/k/g, 'c').replace(/v/g, 'b'),
    (s) => s.replace(/k/g, 'c').replace(/y/g, 'll'),
    (s) => s.replace(/v/g, 'b').replace(/y/g, 'll'),
    (s) => s.replace(/k/g, 'c').replace(/v/g, 'b').replace(/y/g, 'll'),
  ];

  for (const fn of swaps) {
    const v = fn(base).trim();
    if (v) out.add(v);
  }

  return Array.from(out);
}
