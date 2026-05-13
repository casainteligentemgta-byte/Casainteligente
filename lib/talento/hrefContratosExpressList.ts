const PATH = '/talento/admin/contratos/fast-list';

/**
 * Ruta del listado admin de contratos express.
 * Por defecto es **relativa** al host donde corre la app (p. ej. en producción:
 * `/talento/admin/contratos/fast-list` → `https://casainteligente.company/talento/admin/contratos/fast-list`).
 *
 * Solo si defines `NEXT_PUBLIC_TALENTO_EXPRESS_LIST_ORIGIN` (origen `https://…` sin barra final),
 * los enlaces apuntan a ese host + esta ruta (p. ej. otro deployment).
 */
export function hrefContratosExpressList(params?: { modulo_integral?: string }): string {
  const origin =
    typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_TALENTO_EXPRESS_LIST_ORIGIN ?? '').trim().replace(/\/$/, '') : '';
  const sp = new URLSearchParams();
  const mid = params?.modulo_integral?.trim();
  if (mid) sp.set('modulo_integral', mid);
  const q = sp.toString();
  const suffix = q ? `?${q}` : '';
  if (origin) return `${origin}${PATH}${suffix}`;
  return `${PATH}${suffix}`;
}

export function navigateToContratosExpressList(
  router: { push: (href: string) => void },
  params?: { modulo_integral?: string },
): void {
  const url = hrefContratosExpressList(params);
  if (typeof window === 'undefined') return;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const u = new URL(url);
      if (u.origin === window.location.origin) {
        router.push(`${u.pathname}${u.search}` || '/');
        return;
      }
    } catch {
      /* assign */
    }
    window.location.assign(url);
    return;
  }
  router.push(url);
}
