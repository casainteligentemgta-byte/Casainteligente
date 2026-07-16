/** Redirige a login conservando la ruta actual (cliente). */
export function urlLoginConRetorno(nextPath?: string): string {
  if (typeof window === 'undefined') return '/login';
  const next =
    nextPath?.trim() ||
    `${window.location.pathname}${window.location.search}`;
  const safe =
    next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')
      ? next
      : '/contabilidad/compras';
  return `/login?next=${encodeURIComponent(safe)}`;
}

export function redirigirALoginSi401(res: Response, nextPath?: string): boolean {
  if (res.status !== 401) return false;
  if (typeof window !== 'undefined') {
    window.location.href = urlLoginConRetorno(nextPath);
  }
  return true;
}
