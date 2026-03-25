/**
 * Texto en presupuesto: minúsculas salvo la primera letra (tipo oración).
 */
export function textoPresupuesto(s: string | null | undefined): string {
  if (s == null) return '';
  const t = String(s).trim();
  if (!t) return '';
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Quita HTML/markdown que podría pintar una imagen junto al título del ítem
 * (p. ej. `<img src="…">` o `![](url)` guardados por error en `nombre`).
 */
export function tituloPresupuestoPlano(s: string | null | undefined): string {
  if (s == null) return '';
  let t = String(s).trim();
  if (!t) return '';
  t = t.replace(/<img\b[^>]*>/gi, ' ');
  t = t.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, ' ');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  /* data: o URL de imagen pegados en el nombre */
  t = t.replace(/data:image\/[a-z0-9+.-]+;base64,[a-z0-9+/=\s]+/gi, ' ');
  t = t.replace(/https?:\/\/[^\s]+\.(png|jpe?g|webp|gif|svg)(\?[^\s]*)?/gi, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/** Título de línea listo para mostrar en tabla / WhatsApp (plano + estilo oración). */
export function lineaPresupuestoTitulo(s: string | null | undefined, fallback = 'Ítem'): string {
  const plain = tituloPresupuestoPlano(s);
  if (!plain) return fallback;
  return textoPresupuesto(plain);
}
