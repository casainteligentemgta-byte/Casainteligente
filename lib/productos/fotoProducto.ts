/**
 * Foto del producto: un solo campo canónico (`imagen`).
 *
 * Durante años coexistieron `products.imagen` (formulario, importación, catálogo)
 * y `products.image_url` (NetVision, tipos viejos, un SQL suelto de 2026).
 * La importación y el alta escriben `imagen`; quien leía solo `image_url`
 * veía el catálogo «sin foto». No se inventan fotos: solo se unifica la URL
 * que ya exista.
 */

export type ProductoConFoto = {
  imagen?: string | null
  image_url?: string | null
}

function urlLimpia(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t ? t : null
}

/** URL a mostrar: `imagen` primero; `image_url` solo como leftover previo a la unificación. */
export function urlFotoProducto(p: ProductoConFoto | null | undefined): string | null {
  if (!p) return null
  return urlLimpia(p.imagen) ?? urlLimpia(p.image_url)
}

export function productoSinFoto(p: ProductoConFoto | null | undefined): boolean {
  return urlFotoProducto(p) == null
}

/** Escritura: solo `imagen`. El trigger de la migración copia a `image_url`. */
export function payloadFotoProducto(url: string | null | undefined): { imagen: string | null } {
  return { imagen: urlLimpia(url) }
}
