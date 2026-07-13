/**
 * URL absoluta hacia rutas `/api/*` desde el navegador.
 * Evita 404 cuando una ruta relativa no se resuelve contra el origen de Next (p. ej. vistas file:// o proxies).
 */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (typeof window === 'undefined') {
    return p
  }
  if (!window.location.protocol.startsWith('http')) {
    return p
  }
  return new URL(p, window.location.origin).href
}

export function assertHttpOrigin(): string | null {
  if (typeof window === 'undefined') return null
  if (!window.location.protocol.startsWith('http')) {
    return 'Abre la aplicación con http:// o https:// (por ejemplo http://localhost:3000). No uses archivos locales (file://).'
  }
  return null
}
