const PATH = '/talento/admin/contratos/fast-list';

/**
 * Ruta del listado admin de contratos express (mismo host que la app: preview Vercel, producción, localhost, etc.).
 */
export function hrefContratosExpressList(params?: { modulo_integral?: string }): string {
  const sp = new URLSearchParams();
  const mid = params?.modulo_integral?.trim();
  if (mid) sp.set('modulo_integral', mid);
  const q = sp.toString();
  return q ? `${PATH}?${q}` : PATH;
}

export function navigateToContratosExpressList(
  router: { push: (href: string) => void },
  params?: { modulo_integral?: string },
): void {
  router.push(hrefContratosExpressList(params));
}
